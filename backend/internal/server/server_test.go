// Copyright Contributors to the Open Cluster Management project

package server_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stolostron/console/backend/internal/config"
	"github.com/stolostron/console/backend/internal/server"
)

func TestStripMulticloud(t *testing.T) {
	cases := map[string]string{
		"/multicloud":               "/",
		"/multicloud/":              "/",
		"/multicloud/livenessProbe": "/livenessProbe",
		"/multicloud/api/v1/pods":   "/api/v1/pods",
		"/livenessProbe":            "/livenessProbe",
		"/":                         "/",
	}
	for in, want := range cases {
		if got := server.StripMulticloud(in); got != want {
			t.Errorf("StripMulticloud(%q)=%q want %q", in, got, want)
		}
	}
}

func TestProbesAndProxy(t *testing.T) {
	var capturedPath, capturedMethod, capturedBody string
	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ping" {
			w.WriteHeader(http.StatusOK)
			return
		}
		capturedPath = r.URL.Path
		capturedMethod = r.Method
		b, _ := io.ReadAll(r.Body)
		capturedBody = string(b)
		w.Header().Set("X-Sidecar", "yes")
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer sidecar.Close()

	cfg := &config.Config{
		NodeBackendURL: sidecar.URL,
		CertsDir:       t.TempDir(),
	}
	h, err := server.Handler(cfg)
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(h)
	defer ts.Close()

	for _, path := range []string{"/ping", "/livenessProbe", "/readinessProbe", "/multicloud/ping", "/multicloud/livenessProbe", "/multicloud/readinessProbe"} {
		resp, err := ts.Client().Get(ts.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("%s status %d", path, resp.StatusCode)
		}
		if len(body) != 0 {
			t.Fatalf("%s expected empty body", path)
		}
	}

	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/multicloud/hub", strings.NewReader("hello"))
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusTeapot {
		t.Fatalf("proxy status %d", resp.StatusCode)
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("body %s", body)
	}
	if resp.Header.Get("X-Sidecar") != "yes" {
		t.Fatal("missing sidecar header")
	}
	if capturedPath != "/multicloud/hub" {
		t.Fatalf("sidecar path %q, want original /multicloud/hub", capturedPath)
	}
	if capturedMethod != http.MethodPost {
		t.Fatalf("method %s", capturedMethod)
	}
	if capturedBody != "hello" {
		t.Fatalf("body %q", capturedBody)
	}
}

func TestProxyForwardsAuthorization(t *testing.T) {
	var capturedAuth string
	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer sidecar.Close()

	cfg := &config.Config{NodeBackendURL: sidecar.URL, CertsDir: t.TempDir()}
	h, err := server.Handler(cfg)
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(h)
	defer ts.Close()

	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/multicloud/username", nil)
	req.Header.Set("Authorization", "Bearer user-token")
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if capturedAuth != "Bearer user-token" {
		t.Fatalf("Authorization %q", capturedAuth)
	}
}

func TestWebSocketUpgradeForwardsOriginalPath(t *testing.T) {
	var capturedPath, capturedUpgrade string
	sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		capturedUpgrade = r.Header.Get("Upgrade")
		w.WriteHeader(http.StatusOK)
	}))
	defer sidecar.Close()

	cfg := &config.Config{NodeBackendURL: sidecar.URL, CertsDir: t.TempDir()}
	h, err := server.Handler(cfg)
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(h)
	defer ts.Close()

	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/multicloud/proxy/search", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if capturedPath != "/multicloud/proxy/search" {
		t.Fatalf("path %q", capturedPath)
	}
	if capturedUpgrade != "websocket" {
		t.Fatalf("upgrade %q", capturedUpgrade)
	}
}
