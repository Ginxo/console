// Copyright Contributors to the Open Cluster Management project

package aggregate

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func proxyService(port any) map[string]any {
	svc := map[string]any{
		"apiVersion": "v1",
		"kind":       "Service",
		"metadata": map[string]any{
			"name":      "cluster-proxy-addon-user",
			"namespace": "multicluster-engine",
		},
		"spec": map[string]any{},
	}
	if port != nil {
		svc["spec"] = map[string]any{
			"ports": []any{
				map[string]any{"port": port},
			},
		}
	}
	return svc
}

func TestClusterProxyURLPortTypes(t *testing.T) {
	const cluster = "remote"
	cases := []struct {
		name string
		port any
		want string
	}{
		{name: "default", port: nil, want: "https://cluster-proxy-addon-user.multicluster-engine.svc.cluster.local:9092/remote"},
		{name: "int64", port: int64(9443), want: "https://cluster-proxy-addon-user.multicluster-engine.svc.cluster.local:9443/remote"},
		{name: "float64", port: float64(8443), want: "https://cluster-proxy-addon-user.multicluster-engine.svc.cluster.local:8443/remote"},
		{name: "int", port: 7443, want: "https://cluster-proxy-addon-user.multicluster-engine.svc.cluster.local:7443/remote"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := clusterProxyURL(proxyService(tc.port), cluster)
			if got != tc.want {
				t.Fatalf("got %q want %q", got, tc.want)
			}
		})
	}
}

func TestArgoDestinationMatchesInt64ProxyPort(t *testing.T) {
	e := NewEngine(MapLister{
		"v1|Service": {
			unstructured.Unstructured{Object: proxyService(int64(9443))},
		},
	}, nil, nil)
	clusters := []Cluster{{Name: "remote"}}
	server := "https://cluster-proxy-addon-user.multicluster-engine.svc.cluster.local:9443/remote"
	got := e.argoDestinationCluster(map[string]any{"server": server}, clusters, "", "local-cluster")
	if got != "remote" {
		t.Fatalf("got %q want remote (int64 Service port must match dest.server)", got)
	}
}
