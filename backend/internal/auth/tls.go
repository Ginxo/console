// Copyright Contributors to the Open Cluster Management project

package auth

import (
	"crypto/tls"
	"crypto/x509"
	"net/http"
	"time"
)

// TLSConfigFromCA builds a TLS config that trusts system roots plus optional PEM CA data.
func TLSConfigFromCA(ca []byte) *tls.Config {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}
	if len(ca) > 0 {
		pool.AppendCertsFromPEM(ca)
	}
	return &tls.Config{
		MinVersion: tls.VersionTLS12,
		RootCAs:    pool,
	}
}

// HTTPClient is an outbound client that trusts system roots and the service-account CA.
func HTTPClient(ca []byte, timeout time.Duration) *http.Client {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			TLSClientConfig: TLSConfigFromCA(ca),
			Proxy:           http.ProxyFromEnvironment,
		},
	}
}
