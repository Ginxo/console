// Copyright Contributors to the Open Cluster Management project

package hub

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	applog "github.com/stolostron/console/backend/internal/log"
)

const (
	policyKind             = "Policy"
	defaultFlapThreshold   = 5
	defaultFlapWindow      = 60 * time.Second
	defaultFlapCooldown    = 60 * time.Second
	defaultFlapSettling    = 60 * time.Second
	flapTrackerTTL         = 12 * time.Hour
	defaultThrottlingCheck = 60 * time.Second
)

type flapConfig struct {
	threshold int
	window    time.Duration
	cooldown  time.Duration
	settling  time.Duration
	ttl       time.Duration
	interval  time.Duration
}

func defaultFlapConfig() flapConfig {
	return flapConfig{
		threshold: envIntOr(os.Getenv("FLAP_THRESHOLD"), defaultFlapThreshold),
		window:    envMSOr(os.Getenv("FLAP_WINDOW_MS"), defaultFlapWindow),
		cooldown:  envMSOr(os.Getenv("FLAP_COOLDOWN_MS"), defaultFlapCooldown),
		settling:  envMSOr(os.Getenv("FLAP_SETTLING_MS"), defaultFlapSettling),
		ttl:       flapTrackerTTL,
		interval:  envMSOr(os.Getenv("THROTTLING_CHECK_INTERVAL"), defaultThrottlingCheck),
	}
}

func envIntOr(raw string, fallback int) int {
	n, err := strconv.Atoi(raw)
	if err != nil || n == 0 {
		return fallback
	}
	return n
}

func envMSOr(raw string, fallback time.Duration) time.Duration {
	n, err := strconv.Atoi(raw)
	if err != nil || n == 0 {
		return fallback
	}
	return time.Duration(n) * time.Millisecond
}

type flapEntry struct {
	timestamps []time.Time
	lastCached time.Time
	emerged    time.Time
	throttled  bool
	lastSpec   string
	hasSpec    bool
	object     map[string]any
	lastSent   map[string]any
	gvr        schema.GroupVersionResource
}

type recoveredEvent struct {
	object map[string]any
	gvr    schema.GroupVersionResource
}

type flapState struct {
	mu      sync.Mutex
	entries map[string]*flapEntry
	cfg     flapConfig
	now     func() time.Time
}

func newFlapState(cfg flapConfig) *flapState {
	if cfg.threshold <= 0 {
		cfg.threshold = defaultFlapThreshold
	}
	if cfg.window <= 0 {
		cfg.window = defaultFlapWindow
	}
	if cfg.cooldown <= 0 {
		cfg.cooldown = defaultFlapCooldown
	}
	if cfg.settling <= 0 {
		cfg.settling = defaultFlapSettling
	}
	if cfg.ttl <= 0 {
		cfg.ttl = flapTrackerTTL
	}
	if cfg.interval <= 0 {
		cfg.interval = defaultThrottlingCheck
	}
	return &flapState{entries: map[string]*flapEntry{}, cfg: cfg}
}

func (s *flapState) clock() time.Time {
	if s != nil && s.now != nil {
		return s.now()
	}
	return time.Now()
}

func flapKey(kind, namespace, name string) string {
	return kind + "/" + namespace + "/" + name
}

func kindNSName(obj map[string]any) (kind, namespace, name string) {
	kind, _ = obj["kind"].(string)
	meta, _ := obj["metadata"].(map[string]any)
	if meta == nil {
		return kind, "", ""
	}
	name, _ = meta["name"].(string)
	namespace, _ = meta["namespace"].(string)
	return kind, namespace, name
}

func specKey(obj map[string]any) string {
	spec := obj["spec"]
	if spec == nil {
		spec = map[string]any{}
	}
	raw, err := json.Marshal(spec)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func formatFlappingMessage(kind, namespace, name string, cfg flapConfig) string {
	windowMinutes := int(math.Max(1, math.Round(cfg.window.Minutes())))
	timesPerMinute := int(math.Max(1, math.Round(float64(time.Minute)/float64(cfg.cooldown))))
	return fmt.Sprintf(
		"%s %s in namespace %s has been modified more than %d times in the last %d minutes. Verify this resource is configured correctly. Updates are being limited to %d times per minute.",
		kind, name, namespace, cfg.threshold, windowMinutes, timesPerMinute,
	)
}

func formatFlappingRecoveredMessage(kind, namespace, name string) string {
	return fmt.Sprintf("%s %s in namespace %s is no longer being throttled; policy updates will resume normally.", kind, name, namespace)
}

// shouldThrottle reports whether this Policy update should skip SSE fan-out.
// Non-Policy kinds always return false. When false and the Policy is flapping, obj.throttled is set.
func (s *flapState) shouldThrottle(obj map[string]any, now time.Time, gvr schema.GroupVersionResource) bool {
	if s == nil || obj == nil {
		return false
	}
	kind, namespace, name := kindNSName(obj)
	if kind != policyKind {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	key := flapKey(kind, namespace, name)
	entry := s.entries[key]
	if entry == nil {
		entry = &flapEntry{emerged: now}
		s.entries[key] = entry
	}

	spec := specKey(obj)
	if entry.hasSpec && entry.lastSpec != spec {
		entry.object = nil
		entry.lastSent = nil
		entry.throttled = false
		entry.hasSpec = false
		entry.lastSpec = ""
		return false
	}

	entry.timestamps = append(entry.timestamps, now)
	n := 0
	for _, ts := range entry.timestamps {
		if now.Sub(ts) <= s.cfg.window {
			entry.timestamps[n] = ts
			n++
		}
	}
	entry.timestamps = entry.timestamps[:n]

	if len(entry.timestamps) > s.cfg.threshold && now.Sub(entry.emerged) > s.cfg.settling {
		if !entry.throttled {
			applog.Logger().Warn(formatFlappingMessage(kind, namespace, name, s.cfg))
		}
		entry.object = runtime.DeepCopyJSON(obj)
		obj["throttled"] = true
		entry.throttled = true
	}
	entry.lastSpec = spec
	entry.hasSpec = true
	entry.gvr = gvr

	if entry.throttled {
		if entry.lastCached.IsZero() || now.Sub(entry.lastCached) >= s.cfg.cooldown {
			entry.lastCached = now
			entry.lastSent = runtime.DeepCopyJSON(obj)
			return false
		}
		return true
	}
	entry.lastCached = time.Time{}
	return false
}

func (s *flapState) recover(now time.Time) []recoveredEvent {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	var out []recoveredEvent
	for key, entry := range s.entries {
		if now.Sub(entry.emerged) > s.cfg.ttl {
			delete(s.entries, key)
			continue
		}
		if !entry.throttled || len(entry.timestamps) == 0 {
			continue
		}
		last := entry.timestamps[len(entry.timestamps)-1]
		if now.Sub(last) <= s.cfg.cooldown {
			continue
		}
		if entry.object != nil {
			obj := runtime.DeepCopyJSON(entry.object)
			out = append(out, recoveredEvent{object: obj, gvr: entry.gvr})
			kind, namespace, name := kindNSName(obj)
			applog.Logger().Warn(formatFlappingRecoveredMessage(kind, namespace, name))
		}
		entry.object = nil
		entry.lastSent = nil
		entry.throttled = false
		entry.lastCached = time.Time{}
	}
	return out
}

func (s *flapState) overlay(kind, namespace, name string) (map[string]any, bool) {
	if s == nil {
		return nil, false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	entry := s.entries[flapKey(kind, namespace, name)]
	if entry == nil || !entry.throttled || entry.lastSent == nil {
		return nil, false
	}
	return runtime.DeepCopyJSON(entry.lastSent), true
}

func (s *flapState) entry(kind, namespace, name string) *flapEntry {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.entries[flapKey(kind, namespace, name)]
}

// Start runs the Policy flap recovery checker until ctx is done.
func (h *Hub) Start(ctx context.Context) {
	if h == nil || h.flap == nil {
		return
	}
	go h.monitorThrottle(ctx)
}

func (h *Hub) monitorThrottle(ctx context.Context) {
	interval := h.flap.cfg.interval
	applog.Logger().Info("throttling check started", "interval", interval)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			applog.Logger().Info("monitoring throttled stopped")
			return
		case <-ticker.C:
			h.publishRecovered(h.flap.clock())
		}
	}
}

func (h *Hub) publishRecovered(now time.Time) {
	if h == nil || h.flap == nil {
		return
	}
	for _, rec := range h.flap.recover(now) {
		h.push(Event{Type: TypeModified, Object: rec.object, GVR: rec.gvr})
	}
}
