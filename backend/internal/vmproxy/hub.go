// Copyright Contributors to the Open Cluster Management project

package vmproxy

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	authzv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/stolostron/console/backend/internal/auth"
	applog "github.com/stolostron/console/backend/internal/log"
)

type mchList struct {
	Items []struct {
		Spec *struct {
			Overrides *struct {
				Components []struct {
					Name    string `json:"name"`
					Enabled bool   `json:"enabled"`
				} `json:"components"`
			} `json:"overrides"`
		} `json:"spec"`
	} `json:"items"`
}

func (h *Handler) fineGrainedRBAC(ctx context.Context) bool {
	if h.opts.FineGrained != nil {
		ok, err := h.opts.FineGrained(ctx)
		return err == nil && ok
	}
	if h.hubClient == nil || h.opts.RESTConfig == nil {
		return false
	}
	host := strings.TrimRight(h.opts.RESTConfig.Host, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, host+"/apis/operator.open-cluster-management.io/v1/multiclusterhubs", nil)
	if err != nil {
		applog.Logger().Error("Error getting MultiClusterHub", "error", err)
		return false
	}
	req.Header.Set("Authorization", "Bearer "+h.opts.SAToken)
	req.Header.Set("Accept", "application/json")
	resp, err := h.hubClient.Do(req)
	if err != nil {
		applog.Logger().Error("Error getting MultiClusterHub", "error", err)
		return false
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return false
	}
	var list mchList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return false
	}
	if len(list.Items) == 0 || list.Items[0].Spec == nil || list.Items[0].Spec.Overrides == nil {
		return false
	}
	for _, c := range list.Items[0].Spec.Overrides.Components {
		if c.Name == "fine-grained-rbac" {
			return c.Enabled
		}
	}
	return false
}

func (h *Handler) canCreateMCA(ctx context.Context, userToken, namespace string) bool {
	client, err := h.userKube(userToken)
	if err != nil {
		applog.Logger().Error("vm ssar client", "error", err)
		return false
	}
	review, err := client.AuthorizationV1().SelfSubjectAccessReviews().Create(ctx, &authzv1.SelfSubjectAccessReview{
		Spec: authzv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authzv1.ResourceAttributes{
				Group:     "action.open-cluster-management.io",
				Namespace: namespace,
				Resource:  "managedclusteractions",
				Verb:      "create",
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		applog.Logger().Error("vm ssar", "error", err)
		return false
	}
	return review.Status.Allowed
}

func (h *Handler) vmActorToken(ctx context.Context, namespace string) (string, bool) {
	if h.saKube == nil {
		return "", false
	}
	list, err := h.saKube.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		applog.Logger().Error("Error getting secret in namespace "+namespace, "error", err)
		return "", false
	}
	for i := range list.Items {
		if list.Items[i].Name == "vm-actor" {
			return string(list.Items[i].Data["token"]), true
		}
	}
	return "", false
}

func (h *Handler) userKube(token string) (kubernetes.Interface, error) {
	if h.opts.UserKube != nil {
		return h.opts.UserKube(token)
	}
	return kubernetes.NewForConfig(auth.UserRESTConfig(h.opts.RESTConfig, token))
}

func hubHTTPClient(cfg *rest.Config, tlsCfg *tls.Config) *http.Client {
	if cfg == nil {
		return &http.Client{Transport: &http.Transport{TLSClientConfig: tlsCfg}}
	}
	c, err := rest.HTTPClientFor(cfg)
	if err != nil {
		return &http.Client{Transport: &http.Transport{TLSClientConfig: tlsCfg}}
	}
	return c
}
