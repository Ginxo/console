// Copyright Contributors to the Open Cluster Management project

package clusterproxy_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"k8s.io/client-go/rest"

	"github.com/stolostron/console/backend/internal/clusterproxy"
)

func TestServiceHost(t *testing.T) {
	if got := clusterproxy.ServiceHost(""); got != "cluster-proxy-addon-user.multicluster-engine.svc.cluster.local" {
		t.Fatalf("empty ns: %s", got)
	}
	if got := clusterproxy.ServiceHost("mce"); got != "cluster-proxy-addon-user.mce.svc.cluster.local" {
		t.Fatalf("mce ns: %s", got)
	}
}

func TestHostPortOverride(t *testing.T) {
	r := &clusterproxy.Resolver{HostOverride: "addon.example.com"}
	host, port := r.HostPort(context.Background())
	if host != "addon.example.com" || port != "443" {
		t.Fatalf("got %s:%s", host, port)
	}
}

func TestURLRouteOverride(t *testing.T) {
	r := &clusterproxy.Resolver{RouteOverride: "https://addon.example.com"}
	u, err := r.URL(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if u.String() != "https://addon.example.com" {
		t.Fatalf("url %s", u)
	}
}

func TestNamespaceFromMCE(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/apis/multicluster.openshift.io/v1/multiclusterengines" {
			t.Fatalf("path %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer sa" {
			t.Fatalf("auth %s", r.Header.Get("Authorization"))
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"items": []map[string]any{
				{"spec": map[string]any{"targetNamespace": "custom-mce"}},
			},
		})
	}))
	t.Cleanup(ts.Close)

	r := &clusterproxy.Resolver{
		Hub:     &rest.Config{Host: ts.URL},
		SAToken: "sa",
		Client:  ts.Client(),
	}
	host, port := r.HostPort(context.Background())
	if host != "cluster-proxy-addon-user.custom-mce.svc.cluster.local" || port != "9092" {
		t.Fatalf("got %s:%s", host, port)
	}
	// cached
	host2, _ := r.HostPort(context.Background())
	if host2 != host {
		t.Fatal("expected cache")
	}
}

func TestNamespaceFallbackOnError(t *testing.T) {
	r := &clusterproxy.Resolver{}
	host, port := r.HostPort(context.Background())
	if host != clusterproxy.ServiceHost(clusterproxy.DefaultNamespace) || port != "9092" {
		t.Fatalf("got %s:%s", host, port)
	}
}

func TestTargetURL(t *testing.T) {
	u, err := clusterproxy.TargetURL("addon.example.com", "443")
	if err != nil {
		t.Fatal(err)
	}
	if u.Scheme != "https" || u.Host != "addon.example.com:443" {
		t.Fatalf("url %s", u)
	}
}
