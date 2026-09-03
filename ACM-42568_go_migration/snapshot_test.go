/* Copyright Contributors to the Open Cluster Management project */

package contract

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSelectorQuery(t *testing.T) {
	got := SelectorQuery(map[string]string{
		"metadata.namespace": "multicluster-engine",
		"metadata.name":      "cluster-proxy-addon-user",
	})
	want := "metadata.name=cluster-proxy-addon-user,metadata.namespace=multicluster-engine"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	if SelectorQuery(nil) != "" {
		t.Fatal("empty selector")
	}
}

func TestDiffSnapshots(t *testing.T) {
	a := []ResourceKey{
		{APIVersion: "v1", Kind: "Namespace", Name: "default"},
		{APIVersion: "v1", Kind: "Namespace", Name: "kube-system"},
	}
	b := []ResourceKey{
		{APIVersion: "v1", Kind: "Namespace", Name: "kube-system", UID: "ignored"},
		{APIVersion: "v1", Kind: "Namespace", Name: "default"},
	}
	if err := DiffSnapshots(a, b); err != nil {
		t.Fatal(err)
	}
	c := []ResourceKey{{APIVersion: "v1", Kind: "Namespace", Name: "default"}}
	if err := DiffSnapshots(a, c); err == nil {
		t.Fatal("expected mismatch")
	}
}

func TestExcludePolled(t *testing.T) {
	items := []ResourceKey{
		{APIVersion: "argoproj.io/v1alpha1", Kind: "Application", Name: "app", Namespace: "ns"},
		{APIVersion: "v1", Kind: "Namespace", Name: "default"},
		{APIVersion: "config.openshift.io/v1", Kind: "Authentication", Name: "cluster"},
	}
	resources := []Resource{
		{Kind: "Application", APIVersion: "argoproj.io/v1alpha1", Polled: true},
		{Kind: "Namespace", APIVersion: "v1"},
		{Kind: "Authentication", APIVersion: "config.openshift.io/v1"},
	}
	got := ExcludePolled(items, resources)
	if len(got) != 2 {
		t.Fatalf("got %d", len(got))
	}
	for _, k := range got {
		if k.Kind == "Application" {
			t.Fatal("polled Application should be excluded")
		}
	}
}

func TestShouldCompareREST(t *testing.T) {
	if shouldCompareREST(Case{Kind: "sse"}) {
		t.Fatal("sse must not compare (ACM-42598)")
	}
	if shouldCompareREST(Case{Kind: "websocket"}) {
		t.Fatal("websocket must not compare")
	}
	if !shouldCompareREST(Case{Kind: "rest"}) {
		t.Fatal("rest should compare")
	}
}

func TestCacheSnapshotSkipWhenMissing(t *testing.T) {
	cfg := LoadConfig()
	if cfg.Token == "" {
		cfg.Token = ocToken()
	}
	goURL := os.Getenv("CONTRACT_GO_SNAPSHOT_URL")
	if goURL == "" {
		goURL = cfg.ResolveURL(cfg.BackendURL, "/debug/informer-snapshot")
	}
	nodeURL := os.Getenv("CONTRACT_NODE_SNAPSHOT_URL")
	nodeFile := os.Getenv("CONTRACT_NODE_SNAPSHOT_FILE")
	goFile := os.Getenv("CONTRACT_GO_SNAPSHOT_FILE")

	var goDoc SnapshotDoc
	var haveGo bool
	if goFile != "" {
		doc, err := LoadSnapshotFile(goFile)
		if err != nil {
			t.Fatal(err)
		}
		goDoc = doc
		haveGo = true
	} else {
		doc, status, err := FetchSnapshot(cfg, goURL)
		if err != nil || status == http.StatusNotFound {
			t.Skipf("Go informer snapshot not available at %s (ACM-42597 not wired yet): %v", goURL, err)
		}
		if status != http.StatusOK {
			t.Skipf("Go snapshot GET %s -> %d", goURL, status)
		}
		goDoc = doc
		haveGo = true
	}

	var nodeDoc SnapshotDoc
	var haveNode bool
	switch {
	case nodeFile != "":
		doc, err := LoadSnapshotFile(nodeFile)
		if err != nil {
			t.Fatal(err)
		}
		nodeDoc = doc
		haveNode = true
	case nodeURL != "":
		doc, status, err := FetchSnapshot(cfg, nodeURL)
		if err != nil || status != http.StatusOK {
			t.Skipf("Node snapshot not available at %s: %v", nodeURL, err)
		}
		nodeDoc = doc
		haveNode = true
	}

	if !haveGo {
		t.Skip("no Go snapshot")
	}
	_, resources, err := LoadCatalog(catalogDir(t))
	if err != nil {
		t.Fatal(err)
	}
	goItems := ExcludePolled(goDoc.Items, resources)
	if !haveNode {
		t.Logf("Go snapshot items=%d (polled excluded); set CONTRACT_NODE_SNAPSHOT_URL or CONTRACT_NODE_SNAPSHOT_FILE to compare", len(goItems))
		return
	}
	nodeItems := ExcludePolled(nodeDoc.Items, resources)
	if err := DiffSnapshots(nodeItems, goItems); err != nil {
		t.Fatal(err)
	}
}

func TestFetchSnapshotOK(t *testing.T) {
	doc := SnapshotDoc{Items: []ResourceKey{{APIVersion: "v1", Kind: "Namespace", Name: "default"}}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(doc)
	}))
	defer srv.Close()
	got, status, err := FetchSnapshot(Config{HTTPTimeout: 5 * time.Second, InsecureTLS: true}, srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	if status != 200 || len(got.Items) != 1 {
		t.Fatalf("status=%d items=%d", status, len(got.Items))
	}
}

func TestLoadSnapshotFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "snap.json")
	body := `{"items":[{"apiVersion":"v1","kind":"Namespace","name":"default"}]}`
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	doc, err := LoadSnapshotFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(doc.Items) != 1 || doc.Items[0].Name != "default" {
		t.Fatalf("%+v", doc)
	}
}

func TestResourceSpecKeyStable(t *testing.T) {
	a := Resource{Kind: "Secret", APIVersion: "v1", LabelSelector: map[string]string{"cluster.open-cluster-management.io/type": "ans"}}
	b := Resource{Kind: "Secret", APIVersion: "v1", LabelSelector: map[string]string{"cluster.open-cluster-management.io/type": "ans"}}
	if a.SpecKey() != b.SpecKey() {
		t.Fatal(a.SpecKey())
	}
	if !strings.Contains(a.SpecKey(), "cluster.open-cluster-management.io/type=ans") {
		t.Fatal(a.SpecKey())
	}
}
