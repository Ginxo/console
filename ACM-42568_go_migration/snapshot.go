/* Copyright Contributors to the Open Cluster Management project */

package contract

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

// ResourceKey is the normalized cache identity used by the ACM-42597 snapshot gate.
type ResourceKey struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Namespace  string `json:"namespace,omitempty"`
	Name       string `json:"name"`
	UID        string `json:"uid,omitempty"`
}

func (k ResourceKey) CompareKey() string {
	return k.APIVersion + "|" + k.Kind + "|" + k.Namespace + "|" + k.Name
}

// SnapshotDoc is the JSON body of GET /debug/informer-snapshot (Go, ACM-42597)
// or a file produced by compare-informer-cache.sh.
type SnapshotDoc struct {
	Synced bool          `json:"synced,omitempty"`
	Items  []ResourceKey `json:"items"`
}

func SelectorQuery(m map[string]string) string {
	if len(m) == 0 {
		return ""
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+m[k])
	}
	return strings.Join(parts, ",")
}

func NormalizeSnapshotKeys(items []ResourceKey) []ResourceKey {
	out := make([]ResourceKey, len(items))
	for i, k := range items {
		out[i] = ResourceKey{
			APIVersion: k.APIVersion,
			Kind:       k.Kind,
			Namespace:  k.Namespace,
			Name:       k.Name,
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CompareKey() < out[j].CompareKey()
	})
	return out
}

func ExcludePolled(items []ResourceKey, resources []Resource) []ResourceKey {
	polled := map[string]struct{}{}
	for _, r := range resources {
		if r.Polled {
			polled[r.APIVersion+"|"+r.Kind] = struct{}{}
		}
	}
	if len(polled) == 0 {
		return items
	}
	out := make([]ResourceKey, 0, len(items))
	for _, k := range items {
		if _, skip := polled[k.APIVersion+"|"+k.Kind]; skip {
			continue
		}
		out = append(out, k)
	}
	return out
}

func DiffSnapshots(a, b []ResourceKey) error {
	na := NormalizeSnapshotKeys(a)
	nb := NormalizeSnapshotKeys(b)
	sa := map[string]struct{}{}
	sb := map[string]struct{}{}
	for _, k := range na {
		sa[k.CompareKey()] = struct{}{}
	}
	for _, k := range nb {
		sb[k.CompareKey()] = struct{}{}
	}
	var onlyA, onlyB []string
	for k := range sa {
		if _, ok := sb[k]; !ok {
			onlyA = append(onlyA, k)
		}
	}
	for k := range sb {
		if _, ok := sa[k]; !ok {
			onlyB = append(onlyB, k)
		}
	}
	sort.Strings(onlyA)
	sort.Strings(onlyB)
	if len(onlyA) == 0 && len(onlyB) == 0 {
		return nil
	}
	return fmt.Errorf("snapshot mismatch: only A (%d): %v; only B (%d): %v", len(onlyA), truncateList(onlyA, 20), len(onlyB), truncateList(onlyB, 20))
}

func truncateList(s []string, n int) []string {
	if len(s) <= n {
		return s
	}
	return append(s[:n], fmt.Sprintf("… +%d more", len(s)-n))
}

func LoadSnapshotFile(path string) (SnapshotDoc, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return SnapshotDoc{}, err
	}
	var doc SnapshotDoc
	if err := json.Unmarshal(b, &doc); err != nil {
		return SnapshotDoc{}, err
	}
	return doc, nil
}

func FetchSnapshot(cfg Config, rawURL string) (SnapshotDoc, int, error) {
	client := cfg.NewHTTPClient(15 * time.Second)
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return SnapshotDoc{}, 0, err
	}
	if cfg.Token != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}
	resp, err := client.Do(req)
	if err != nil {
		return SnapshotDoc{}, 0, err
	}
	defer resp.Body.Close()
	var doc SnapshotDoc
	if resp.StatusCode != http.StatusOK {
		return SnapshotDoc{}, resp.StatusCode, fmt.Errorf("GET %s -> %d", rawURL, resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return SnapshotDoc{}, resp.StatusCode, err
	}
	return doc, resp.StatusCode, nil
}

// shouldCompareREST is the ACM-42598 hook: CONTRACT_COMPARE_URL diffs REST only.
// SSE and WebSocket are skipped until a dedicated shadow-diff exists.
func shouldCompareREST(cs Case) bool {
	kind := strings.ToLower(cs.Kind)
	return kind != "sse" && kind != "websocket"
}
