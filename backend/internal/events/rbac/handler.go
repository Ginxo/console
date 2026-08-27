// Copyright Contributors to the Open Cluster Management project

package rbac

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	rbacv1 "k8s.io/api/rbac/v1"

	"github.com/stolostron/console/backend/internal/auth"
	applog "github.com/stolostron/console/backend/internal/log"
)

const keepAlive = 10 * time.Second

// Authenticator validates a user token (TokenReview).
type Authenticator interface {
	Authenticate(ctx context.Context, token string) (bool, error)
}

type tokenReviewAuth struct {
	reviewer auth.TokenReviewer
}

func (t tokenReviewAuth) Authenticate(ctx context.Context, token string) (bool, error) {
	return t.reviewer.Review(ctx, token)
}

// StaticAuth is for tests.
type StaticAuth struct {
	OK bool
}

func (s StaticAuth) Authenticate(context.Context, string) (bool, error) {
	return s.OK, nil
}

type watchPayload struct {
	Type   string              `json:"type"`
	Object *rbacv1.ClusterRole `json:"object,omitempty"`
}

// Handler serves GET /events/rbac as uncompressed SSE.
type Handler struct {
	store  *Store
	authn  Authenticator
	access AccessChecker
}

func NewHandler(store *Store, reviewer auth.TokenReviewer, access AccessChecker) *Handler {
	return &Handler{
		store:  store,
		authn:  tokenReviewAuth{reviewer: reviewer},
		access: access,
	}
}

// NewHandlerWithAuth injects a test authenticator.
func NewHandlerWithAuth(store *Store, authn Authenticator, access AccessChecker) *Handler {
	return &Handler{store: store, authn: authn, access: access}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	token := auth.TokenFromRequest(r)
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	ok, err := h.authn.Authenticate(r.Context(), token)
	if err != nil || !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ch := h.store.Subscribe()
	defer h.store.Unsubscribe(ch)

	if err := writeSSE(w, flusher, watchPayload{Type: "START"}); err != nil {
		return
	}
	for _, role := range h.store.List() {
		allowed, err := h.access.CanSee(r.Context(), token, role)
		if err != nil {
			applog.Logger().Warn("rbac ssar failed", "error", err, "name", role.Name)
			continue
		}
		if !allowed {
			continue
		}
		if err := writeSSE(w, flusher, watchPayload{Type: "ADDED", Object: role}); err != nil {
			return
		}
	}
	if err := writeSSE(w, flusher, watchPayload{Type: "EOP"}); err != nil {
		return
	}
	if err := writeSSE(w, flusher, watchPayload{Type: "LOADED"}); err != nil {
		return
	}

	ping := time.NewTicker(keepAlive)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ping.C:
			if _, err := w.Write([]byte(": ping\n\n")); err != nil {
				return
			}
			flusher.Flush()
		case ev, ok := <-ch:
			if !ok {
				return
			}
			if ev.Type != "DELETED" {
				allowed, err := h.access.CanSee(r.Context(), token, ev.Role)
				if err != nil || !allowed {
					continue
				}
			}
			if err := writeSSE(w, flusher, watchPayload{Type: ev.Type, Object: ev.Role}); err != nil {
				return
			}
			if err := writeSSE(w, flusher, watchPayload{Type: "EOP"}); err != nil {
				return
			}
		}
	}
}

func writeSSE(w http.ResponseWriter, flusher http.Flusher, payload watchPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte("data: ")); err != nil {
		return err
	}
	if _, err := w.Write(body); err != nil {
		return err
	}
	if _, err := w.Write([]byte("\n\n")); err != nil {
		return err
	}
	flusher.Flush()
	return nil
}
