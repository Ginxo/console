// Copyright Contributors to the Open Cluster Management project

package informers

import (
	"context"
	"runtime"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8swatch "k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"

	applog "github.com/stolostron/console/backend/internal/log"
)

// Start launches one informer per DefaultWatchSpecs entry. It does not block the caller.
func Start(ctx context.Context, dyn dynamic.Interface, mapper ResourceMapper) *InformerCache {
	return StartSpecs(ctx, dyn, mapper, DefaultWatchSpecs())
}

// StartSpecs is Start with an explicit spec list (tests).
func StartSpecs(ctx context.Context, dyn dynamic.Interface, mapper ResourceMapper, specs []WatchSpec) *InformerCache {
	c := newCache(specs)
	for i := range c.states {
		st := c.states[i]
		go c.runSpec(ctx, dyn, mapper, st)
	}
	go c.logMemoryWhenReady(ctx)
	return c
}

func (c *InformerCache) runSpec(ctx context.Context, dyn dynamic.Interface, mapper ResourceMapper, st *specRuntime) {
	for {
		if ctx.Err() != nil {
			return
		}
		gvr, err := ResolveGVR(mapper, st.spec.APIVersion, st.spec.Kind)
		if err != nil {
			st.setError(err)
			if isUnavailable(err) {
				st.unavailable.Store(true)
				applog.Logger().Info("informer spec unavailable; retrying",
					"kind", st.spec.Kind, "apiVersion", st.spec.APIVersion, "error", err)
			} else {
				applog.Logger().Warn("informer GVR resolve failed; retrying",
					"kind", st.spec.Kind, "apiVersion", st.spec.APIVersion, "error", err)
			}
			if !waitRetry(ctx) {
				return
			}
			continue
		}
		st.unavailable.Store(false)
		st.setError(nil)

		lw := newListWatch(dyn, gvr, st.spec)
		inf := cache.NewSharedIndexInformer(lw, &unstructured.Unstructured{}, resyncPeriod, cache.Indexers{
			cache.NamespaceIndex: cache.MetaNamespaceIndexFunc,
		})
		if err := inf.SetTransform(transformFor(st.spec)); err != nil {
			applog.Logger().Warn("informer transform", "kind", st.spec.Kind, "error", err)
		}

		c.mu.Lock()
		st.gvr = gvr
		st.informer = inf
		c.mu.Unlock()

		go inf.Run(ctx.Done())

		syncCtx, cancel := context.WithTimeout(ctx, syncGiveUpAfter)
		if cache.WaitForCacheSync(syncCtx.Done(), inf.HasSynced) {
			cancel()
			st.unavailable.Store(false)
			st.synced.Store(true)
			applog.Logger().Info("informer synced",
				"kind", st.spec.Kind, "apiVersion", st.spec.APIVersion, "resource", gvr.Resource)
			<-ctx.Done()
			return
		}
		cancel()
		if ctx.Err() != nil {
			return
		}
		applog.Logger().Error("informer cache sync timed out; not blocking HasSynced",
			"kind", st.spec.Kind, "apiVersion", st.spec.APIVersion)
		st.unavailable.Store(true)
		if cache.WaitForCacheSync(ctx.Done(), inf.HasSynced) {
			st.unavailable.Store(false)
			st.synced.Store(true)
		}
		return
	}
}

func newListWatch(dyn dynamic.Interface, gvr schema.GroupVersionResource, spec WatchSpec) *cache.ListWatch {
	ns := metav1.NamespaceAll
	return &cache.ListWatch{
		ListFunc: func(options metav1.ListOptions) (k8sruntime.Object, error) {
			applySelectors(spec, &options)
			return dyn.Resource(gvr).Namespace(ns).List(context.TODO(), options)
		},
		WatchFunc: func(options metav1.ListOptions) (k8swatch.Interface, error) {
			applySelectors(spec, &options)
			return dyn.Resource(gvr).Namespace(ns).Watch(context.TODO(), options)
		},
	}
}

func applySelectors(spec WatchSpec, options *metav1.ListOptions) {
	if s := SelectorQuery(spec.LabelSelector); s != "" {
		options.LabelSelector = s
	}
	if s := SelectorQuery(spec.FieldSelector); s != "" {
		options.FieldSelector = s
	}
}

func (c *InformerCache) logMemoryWhenReady(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	timeout := time.NewTimer(2 * time.Minute)
	defer timeout.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timeout.C:
			c.logHeap("informer cache memory (sync wait timed out)")
			return
		case <-ticker.C:
			if c.HasSynced() {
				c.logHeap("informer cache memory")
				return
			}
		}
	}
}

func (c *InformerCache) logHeap(msg string) {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	applog.Logger().Info(msg,
		"heapAlloc", ms.HeapAlloc,
		"heapInuse", ms.HeapInuse,
		"items", len(c.Snapshot()),
		"note", "compare Go heapAlloc of this process after sync to Node deflate cache size, not combined dual-run RSS",
	)
}
