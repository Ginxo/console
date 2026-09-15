/* Copyright Contributors to the Open Cluster Management project */

package contract

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

func eventsTSPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Join(filepath.Dir(file), "..", "backend-node", "src", "routes", "events.ts")
}

func TestWatchedResourcesMatchEventsTS(t *testing.T) {
	_, resources, err := LoadCatalog(catalogDir(t))
	if err != nil {
		t.Fatal(err)
	}
	yamlSpecs := EventsWatchSpecs(resources)
	if len(yamlSpecs) != 67 {
		t.Fatalf("expected 67 events.ts watch specs, got %d", len(yamlSpecs))
	}

	src, err := os.ReadFile(eventsTSPath(t))
	if err != nil {
		t.Fatal(err)
	}
	tsSpecs, err := parseEventsDefinitions(src)
	if err != nil {
		t.Fatal(err)
	}
	if len(tsSpecs) != 67 {
		t.Fatalf("events.ts definitions: got %d, want 67", len(tsSpecs))
	}

	yamlByKey := map[string]Resource{}
	for _, r := range yamlSpecs {
		yamlByKey[r.SpecKey()] = r
	}
	tsByKey := map[string]Resource{}
	for _, r := range tsSpecs {
		tsByKey[r.SpecKey()] = r
	}
	for k, ts := range tsByKey {
		y, ok := yamlByKey[k]
		if !ok {
			t.Errorf("missing in watched-resources.yaml: %+v", ts)
			continue
		}
		if y.Polled != ts.Polled {
			t.Errorf("%s polled yaml=%v ts=%v", k, y.Polled, ts.Polled)
		}
		if y.ForwardsToClients() != ts.ForwardsToClients() {
			t.Errorf("%s forwardEventsToClients yaml=%v ts=%v", k, y.ForwardsToClients(), ts.ForwardsToClients())
		}
	}
	for k, y := range yamlByKey {
		if _, ok := tsByKey[k]; !ok {
			t.Errorf("extra in watched-resources.yaml (not in events.ts): %+v", y)
		}
	}

	var rbac int
	for _, r := range resources {
		if r.Source == "events-rbac" {
			rbac++
			if r.Kind != "ClusterRole" {
				t.Errorf("events-rbac spec should be ClusterRole, got %s", r.Kind)
			}
		}
	}
	if rbac != 1 {
		t.Fatalf("expected 1 events-rbac spec (ClusterRole), got %d", rbac)
	}
}

var (
	kindRE       = regexp.MustCompile(`kind:\s*'([^']+)'`)
	apiVersionRE = regexp.MustCompile(`apiVersion:\s*'([^']+)'`)
	selectorRE   = regexp.MustCompile(`'([^']+)':\s*'([^']*)'`)
)

func parseEventsDefinitions(src []byte) ([]Resource, error) {
	s := string(src)
	marker := "const definitions: IWatchOptions[] = ["
	start := strings.Index(s, marker)
	if start < 0 {
		return nil, fmt.Errorf("definitions array not found")
	}
	rest := s[start+len(marker):]
	end := strings.Index(rest, "\nexport function startWatching")
	if end < 0 {
		return nil, fmt.Errorf("end of definitions not found")
	}
	body := stripTSLineComments(rest[:end])
	objs := extractTSObjects(body)
	out := make([]Resource, 0, len(objs))
	for _, obj := range objs {
		r, err := parseTSWatchObject(obj)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

func stripTSLineComments(s string) string {
	lines := strings.Split(s, "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "//") {
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func extractTSObjects(s string) []string {
	var objs []string
	depth := 0
	start := -1
	inQuote := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c == '\'' && (i == 0 || s[i-1] != '\\') {
			inQuote = !inQuote
			continue
		}
		if inQuote {
			continue
		}
		switch c {
		case '{':
			if depth == 0 {
				start = i
			}
			depth++
		case '}':
			depth--
			if depth == 0 && start >= 0 {
				objs = append(objs, s[start:i+1])
				start = -1
			}
		}
	}
	return objs
}

func parseTSWatchObject(obj string) (Resource, error) {
	km := kindRE.FindStringSubmatch(obj)
	am := apiVersionRE.FindStringSubmatch(obj)
	if km == nil || am == nil {
		return Resource{}, fmt.Errorf("kind/apiVersion missing in %s", obj)
	}
	r := Resource{Kind: km[1], APIVersion: am[1]}
	if strings.Contains(obj, "isPolled: true") {
		r.Polled = true
	}
	if strings.Contains(obj, "forwardEventsToClients: false") {
		f := false
		r.ForwardEventsToClients = &f
	}
	if i := strings.Index(obj, "labelSelector:"); i >= 0 {
		r.LabelSelector = parseTSSelector(obj[i:])
	}
	if i := strings.Index(obj, "fieldSelector:"); i >= 0 {
		r.FieldSelector = parseTSSelector(obj[i:])
	}
	return r, nil
}

func parseTSSelector(s string) map[string]string {
	brace := strings.Index(s, "{")
	if brace < 0 {
		return nil
	}
	end := strings.Index(s[brace:], "}")
	if end < 0 {
		return nil
	}
	inner := s[brace : brace+end]
	out := map[string]string{}
	for _, m := range selectorRE.FindAllStringSubmatch(inner, -1) {
		out[m[1]] = m[2]
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
