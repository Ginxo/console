// Copyright Contributors to the Open Cluster Management project

package vmproxy

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	authzv1 "k8s.io/api/authorization/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
	"k8s.io/client-go/rest"
)

func mchResponse(enabled bool) string {
	flag := "false"
	if enabled {
		flag = "true"
	}
	return `{"items":[{"spec":{"overrides":{"components":[{"name":"fine-grained-rbac","enabled":` + flag + `}]}}}]}`
}

func TestFineGrainedRBAC_OptionOverride(t *testing.T) {
	h := &Handler{opts: Options{FineGrained: func(context.Context) (bool, error) { return true, nil }}}
	if !h.fineGrainedRBAC(context.Background()) {
		t.Fatal("expected override to enable fine-grained RBAC")
	}
}

func TestFineGrainedRBAC_FromHub(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/apis/operator.open-cluster-management.io/v1/multiclusterhubs" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer sa-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(mchResponse(true)))
	}))
	t.Cleanup(ts.Close)

	h := &Handler{
		opts:      Options{SAToken: "sa-token", RESTConfig: &rest.Config{Host: ts.URL}},
		hubClient: ts.Client(),
	}
	if !h.fineGrainedRBAC(context.Background()) {
		t.Fatal("expected fine-grained RBAC enabled from hub")
	}
}

func TestFineGrainedRBAC_DisabledComponent(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(mchResponse(false)))
	}))
	t.Cleanup(ts.Close)

	h := &Handler{
		opts:      Options{SAToken: "sa-token", RESTConfig: &rest.Config{Host: ts.URL}},
		hubClient: ts.Client(),
	}
	if h.fineGrainedRBAC(context.Background()) {
		t.Fatal("expected fine-grained RBAC disabled")
	}
}

func TestFineGrainedRBAC_MissingClient(t *testing.T) {
	h := &Handler{}
	if h.fineGrainedRBAC(context.Background()) {
		t.Fatal("expected false without hub client")
	}
}

func TestFineGrainedRBAC_HubError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(ts.Close)

	h := &Handler{
		opts:      Options{SAToken: "sa-token", RESTConfig: &rest.Config{Host: ts.URL}},
		hubClient: ts.Client(),
	}
	if h.fineGrainedRBAC(context.Background()) {
		t.Fatal("expected false on hub error")
	}
}

func TestCanCreateMCA_Allowed(t *testing.T) {
	client := fake.NewSimpleClientset()
	client.PrependReactor("create", "selfsubjectaccessreviews", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, &authzv1.SelfSubjectAccessReview{
			Status: authzv1.SubjectAccessReviewStatus{Allowed: true},
		}, nil
	})
	h := &Handler{opts: Options{UserKube: func(string) (kubernetes.Interface, error) { return client, nil }}}
	if !h.canCreateMCA(context.Background(), "user-token", "ns") {
		t.Fatal("expected MCA create allowed")
	}
}

func TestCanCreateMCA_Denied(t *testing.T) {
	client := fake.NewSimpleClientset()
	client.PrependReactor("create", "selfsubjectaccessreviews", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, &authzv1.SelfSubjectAccessReview{
			Status: authzv1.SubjectAccessReviewStatus{Allowed: false},
		}, nil
	})
	h := &Handler{opts: Options{UserKube: func(string) (kubernetes.Interface, error) { return client, nil }}}
	if h.canCreateMCA(context.Background(), "user-token", "ns") {
		t.Fatal("expected MCA create denied")
	}
}

func TestVMActorToken_Found(t *testing.T) {
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "vm-actor", Namespace: "cluster-ns"},
		Data:       map[string][]byte{"token": []byte("vm-actor-token")},
	}
	h := &Handler{saKube: fake.NewSimpleClientset(secret)}
	token, ok := h.vmActorToken(context.Background(), "cluster-ns")
	if !ok || token != "vm-actor-token" {
		t.Fatalf("token=%q ok=%v", token, ok)
	}
}

func TestVMActorToken_NotFound(t *testing.T) {
	h := &Handler{saKube: fake.NewSimpleClientset()}
	if token, ok := h.vmActorToken(context.Background(), "cluster-ns"); ok || token != "" {
		t.Fatalf("token=%q ok=%v", token, ok)
	}
}

func TestHubHTTPClient_NilConfig(t *testing.T) {
	c := hubHTTPClient(nil, nil)
	if c == nil {
		t.Fatal("expected client")
	}
}

func TestHubHTTPClient_WithConfig(t *testing.T) {
	c := hubHTTPClient(&rest.Config{Host: "https://example.invalid"}, nil)
	if c == nil {
		t.Fatal("expected client")
	}
}
