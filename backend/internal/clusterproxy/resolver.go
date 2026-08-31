// Copyright Contributors to the Open Cluster Management project

package clusterproxy

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"k8s.io/client-go/rest"

	applog "github.com/stolostron/console/backend/internal/log"
)

const (
	DefaultNamespace = "multicluster-engine"
	inClusterPort    = "9092"
	routePort        = "443"
	servicePrefix    = "cluster-proxy-addon-user"
)

// Resolver finds the cluster-proxy-addon-user endpoint (env override or MCE target namespace).
type Resolver struct {
	HostOverride  string
	RouteOverride string
	// Target, when set, is the full addon URL (tests).
	Target  *url.URL
	Hub     *rest.Config
	SAToken string
	Client  *http.Client

	mu        sync.Mutex
	cachedNS  string
	haveCache bool
}

// ServiceHost is the in-cluster DNS name for the addon user proxy.
func ServiceHost(namespace string) string {
	if namespace == "" {
		namespace = DefaultNamespace
	}
	return servicePrefix + "." + namespace + ".svc.cluster.local"
}

// HostPort is used by the managed-cluster reverse proxy (CLUSTER_PROXY_ADDON_USER_HOST or svc:9092).
func (r *Resolver) HostPort(ctx context.Context) (host, port string) {
	if r != nil && r.Target != nil {
		return hostnamePort(r.Target)
	}
	if r != nil && r.HostOverride != "" {
		return r.HostOverride, routePort
	}
	return ServiceHost(r.namespace(ctx)), inClusterPort
}

// ProxyURL is the addon base URL for ReverseProxy (scheme + host + port).
func (r *Resolver) ProxyURL(ctx context.Context) (*url.URL, error) {
	if r != nil && r.Target != nil {
		return r.Target, nil
	}
	host, port := r.HostPort(ctx)
	return TargetURL(host, port)
}

// URL is used by VM helpers (CLUSTER_PROXY_ADDON_USER_ROUTE or https://svc:9092).
func (r *Resolver) URL(ctx context.Context) (*url.URL, error) {
	if r != nil && r.Target != nil {
		return r.Target, nil
	}
	if r != nil && r.RouteOverride != "" {
		return url.Parse(r.RouteOverride)
	}
	host, port := r.HostPortWithoutHostOverride(ctx)
	return url.Parse("https://" + host + ":" + port)
}

// HostPortWithoutHostOverride ignores CLUSTER_PROXY_ADDON_USER_HOST so VM URL matching Node
// still uses the in-cluster service when only the Route env is unset.
func (r *Resolver) HostPortWithoutHostOverride(ctx context.Context) (host, port string) {
	return ServiceHost(r.namespace(ctx)), inClusterPort
}

func (r *Resolver) namespace(ctx context.Context) string {
	if r == nil {
		return DefaultNamespace
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.haveCache {
		return r.cachedNS
	}
	ns := r.fetchNamespace(ctx)
	r.cachedNS = ns
	r.haveCache = true
	return ns
}

type mceList struct {
	Items []struct {
		Spec struct {
			TargetNamespace string `json:"targetNamespace"`
		} `json:"spec"`
	} `json:"items"`
}

func (r *Resolver) fetchNamespace(ctx context.Context) string {
	if r.Hub == nil || r.Client == nil || r.SAToken == "" {
		return DefaultNamespace
	}
	host := strings.TrimRight(r.Hub.Host, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, host+"/apis/multicluster.openshift.io/v1/multiclusterengines", nil)
	if err != nil {
		applog.Logger().Error("mce request", "error", err)
		return DefaultNamespace
	}
	req.Header.Set("Authorization", "Bearer "+r.SAToken)
	req.Header.Set("Accept", "application/json")
	resp, err := r.Client.Do(req)
	if err != nil {
		applog.Logger().Error("Error getting MultiClusterEngine", "error", err)
		return DefaultNamespace
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		applog.Logger().Error("Error getting MultiClusterEngine", "status", resp.StatusCode)
		return DefaultNamespace
	}
	var list mceList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		applog.Logger().Error("Error getting MultiClusterEngine", "error", err)
		return DefaultNamespace
	}
	if len(list.Items) == 0 || list.Items[0].Spec.TargetNamespace == "" {
		return DefaultNamespace
	}
	return list.Items[0].Spec.TargetNamespace
}

// TargetURL builds https://host:port for ReverseProxy SetURL.
func TargetURL(host, port string) (*url.URL, error) {
	if host == "" {
		return nil, fmt.Errorf("cluster proxy host is empty")
	}
	if port == "" {
		port = inClusterPort
	}
	return url.Parse("https://" + netJoinHostPort(host, port))
}

func netJoinHostPort(host, port string) string {
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		return "[" + host + "]:" + port
	}
	return host + ":" + port
}

func hostnamePort(u *url.URL) (host, port string) {
	host = u.Hostname()
	port = u.Port()
	if port != "" {
		return host, port
	}
	if u.Scheme == "http" {
		return host, "80"
	}
	return host, "443"
}
