// Copyright Contributors to the Open Cluster Management project

package rbac

import (
	"context"
	"fmt"
	"time"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

const resync = 10 * time.Minute

// StartInformer watches vm-clusterroles ClusterRoles into store until ctx is cancelled.
func StartInformer(ctx context.Context, client kubernetes.Interface, store *Store) error {
	factory := informers.NewSharedInformerFactoryWithOptions(
		client,
		resync,
		informers.WithTweakListOptions(func(opts *metav1.ListOptions) {
			opts.LabelSelector = VMClusterRolesSelector
		}),
	)
	informer := factory.Rbac().V1().ClusterRoles().Informer()
	_, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj any) {
			if role, ok := obj.(*rbacv1.ClusterRole); ok {
				store.Upsert("ADDED", role)
			}
		},
		UpdateFunc: func(_, newObj any) {
			if role, ok := newObj.(*rbacv1.ClusterRole); ok {
				store.Upsert("MODIFIED", role)
			}
		},
		DeleteFunc: func(obj any) {
			role, ok := obj.(*rbacv1.ClusterRole)
			if !ok {
				tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
				if !ok {
					return
				}
				role, ok = tombstone.Obj.(*rbacv1.ClusterRole)
				if !ok {
					return
				}
			}
			store.Delete(role)
		},
	})
	if err != nil {
		return err
	}

	factory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), informer.HasSynced) {
		return fmt.Errorf("clusterrole informer cache sync failed")
	}
	return nil
}
