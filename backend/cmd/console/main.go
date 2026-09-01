// Copyright Contributors to the Open Cluster Management project

package main

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"os"
	"os/signal"
	"syscall"

	"k8s.io/client-go/kubernetes"

	"github.com/stolostron/console/backend/internal/auth"
	"github.com/stolostron/console/backend/internal/clusterproxy"
	"github.com/stolostron/console/backend/internal/config"
	rbacevents "github.com/stolostron/console/backend/internal/events/rbac"
	"github.com/stolostron/console/backend/internal/k8sproxy"
	applog "github.com/stolostron/console/backend/internal/log"
	"github.com/stolostron/console/backend/internal/mcproxy"
	"github.com/stolostron/console/backend/internal/metricsproxy"
	"github.com/stolostron/console/backend/internal/server"
	"github.com/stolostron/console/backend/internal/vmproxy"
)

func main() {
	if err := run(); err != nil {
		applog.Logger().Error("process exit", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.Load()
	applog.SetLevel(cfg.LogLevel)

	sa, ok := auth.LoadServiceAccount(cfg)
	if !ok {
		applog.Logger().Error("service account token missing",
			"msg", "set TOKEN or mount /var/run/secrets/kubernetes.io/serviceaccount/token")
		return errMissingToken
	}

	stopWatch, err := cfg.Watch()
	if err != nil {
		applog.Logger().Warn("config watch disabled", "error", err)
	} else {
		defer stopWatch()
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	restCfg, err := auth.RESTConfig(cfg, sa)
	if err != nil {
		return err
	}
	kube, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return err
	}
	store := rbacevents.NewStore()
	if err = rbacevents.StartInformer(ctx, kube, store); err != nil {
		return err
	}
	rbacHandler := rbacevents.NewHandler(store, rbacevents.NewAPIAuth(restCfg), rbacevents.NewSSARAccess(restCfg))

	clusterURL, err := url.Parse(cfg.ClusterAPIURL)
	if err != nil {
		return err
	}
	k8sHandler := k8sproxy.New(clusterURL, k8sproxy.TLSConfigFromCA(sa.CACert))

	serviceTLS := auth.ServiceTLSConfig(sa)
	addonResolver := &clusterproxy.Resolver{
		HostOverride:  cfg.ClusterProxyAddonUserHost,
		RouteOverride: cfg.ClusterProxyAddonUserRoute,
		Hub:           restCfg,
	}
	promURL, err := metricsproxy.ParseTarget(cfg.PrometheusRoute, metricsproxy.DefaultPrometheusURL)
	if err != nil {
		return err
	}
	obsURL, err := metricsproxy.ParseTarget(cfg.ObservabilityRoute, metricsproxy.DefaultObservabilityURL)
	if err != nil {
		return err
	}

	handler, err := server.Handler(cfg,
		server.WithRBACEvents(rbacHandler),
		server.WithK8sProxy(k8sHandler),
		server.WithManagedClusterProxy(mcproxy.New(mcproxy.Options{
			Resolver:   addonResolver,
			TLSConfig:  serviceTLS,
			RESTConfig: restCfg,
		})),
		server.WithPrometheusProxy(metricsproxy.New(promURL, serviceTLS, "/prometheus")),
		server.WithObservabilityProxy(metricsproxy.New(obsURL, serviceTLS, "/observability")),
		server.WithVMProxy(vmproxy.New(vmproxy.Options{
			Resolver:   addonResolver,
			TLSConfig:  serviceTLS,
			RESTConfig: restCfg,
			SAToken:    sa.Token,
		})),
	)
	if err != nil {
		return err
	}

	applog.Logger().Info("process start",
		"PORT", cfg.Port,
		"NODE_BACKEND_URL", cfg.NodeBackendURL,
		slog.String("CONFIG_DIR", cfg.ConfigDir),
	)
	return server.ListenAndServe(ctx, cfg, handler)
}

var errMissingToken = errors.New("service account token missing")
