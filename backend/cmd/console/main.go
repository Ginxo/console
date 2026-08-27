// Copyright Contributors to the Open Cluster Management project

package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/stolostron/console/backend/internal/auth"
	"github.com/stolostron/console/backend/internal/config"
	applog "github.com/stolostron/console/backend/internal/log"
	"github.com/stolostron/console/backend/internal/server"
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

	if _, ok := auth.LoadServiceAccount(cfg); !ok {
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

	handler, err := server.Handler(cfg)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	applog.Logger().Info("process start",
		"PORT", cfg.Port,
		"NODE_BACKEND_URL", cfg.NodeBackendURL,
		slog.String("CONFIG_DIR", cfg.ConfigDir),
	)
	return server.ListenAndServe(ctx, cfg, handler)
}

var errMissingToken = errors.New("service account token missing")
