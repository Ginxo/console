// Copyright Contributors to the Open Cluster Management project

package tlsconfig

import (
	"crypto/tls"
	"crypto/x509"
	"net"
	"net/http"
	"os"
	"testing"
	"time"
)

// Expectations characterized with the pre-Go converter at 3ad2b7bc5 and
// http2.createSecureServer on Node 24.14.1 / OpenSSL 3.5.5. An empty
// ecdhCurve rejects TLS 1.3 and ECDHE, but does not disable RSA key exchange.
func TestEmptyGroupsNodeParity(t *testing.T) {
	dir := t.TempDir()
	cert, key := writeRSACert(t, dir, "node-parity")
	pem, err := os.ReadFile(cert)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(pem) {
		t.Fatal("invalid test root")
	}
	for _, input := range []struct {
		name     string
		groups   []string
		fips     bool
		allowRSA bool
	}{
		{"unknown", []string{"future-group"}, false, true},
		{"unknown without RSA", []string{"future-group"}, false, false},
		{"excluded", []string{"X25519", "X25519MLKEM768"}, true, true},
	} {
		t.Run(input.name, func(t *testing.T) {
			r := NewReloader()
			if err := r.LoadCertificate(cert, key); err != nil {
				t.Fatal(err)
			}
			ciphers := []string{"ECDHE-RSA-AES128-GCM-SHA256", "TLS_AES_128_GCM_SHA256"}
			if input.allowRSA {
				ciphers = append(ciphers, "AES128-GCM-SHA256")
			}
			r.Apply(fromProfile(SecurityProfile{Type: "Custom", Custom: &CustomSpec{
				MinTLSVersion: "VersionTLS12",
				Ciphers:       ciphers,
				Groups:        input.groups,
			}}, input.fips))
			addr, stop := startTLS(t, r)
			defer stop()
			for _, tc := range []struct {
				name     string
				min, max uint16
				cipher   uint16
				allowed  bool
			}{
				{"TLS13", tls.VersionTLS13, tls.VersionTLS13, 0, false},
				{"TLS12 ECDHE", tls.VersionTLS12, tls.VersionTLS12, tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, false},
				{"TLS12 RSA", tls.VersionTLS12, tls.VersionTLS12, tls.TLS_RSA_WITH_AES_128_GCM_SHA256, input.allowRSA},
				{"TLS13 preferred over RSA", tls.VersionTLS12, tls.VersionTLS13, tls.TLS_RSA_WITH_AES_128_GCM_SHA256, false},
			} {
				t.Run(tc.name, func(t *testing.T) {
					cfg := &tls.Config{RootCAs: roots, ServerName: "localhost", MinVersion: tc.min, MaxVersion: tc.max, CurvePreferences: []tls.CurveID{tls.CurveP256}}
					if tc.cipher != 0 {
						cfg.CipherSuites = []uint16{tc.cipher}
					}
					conn, err := tls.DialWithDialer(&net.Dialer{Timeout: time.Second}, "tcp", addr, cfg)
					if conn != nil {
						conn.Close()
					}
					if (err == nil) != tc.allowed {
						t.Fatalf("allowed=%v, handshake error=%v", tc.allowed, err)
					}
				})
			}
		})
	}
}

// Confirms RSA-only fallback does not advertise h2 (HTTP/2 cipher blacklist).
func TestEmptyGroupsRSAUsesHTTP11(t *testing.T) {
	dir := t.TempDir()
	cert, key := writeRSACert(t, dir, "rsa-http11")
	pem, err := os.ReadFile(cert)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(pem) {
		t.Fatal("invalid test root")
	}
	r := NewReloader()
	if loadErr := r.LoadCertificate(cert, key); loadErr != nil {
		t.Fatal(loadErr)
	}
	r.Apply(fromProfile(SecurityProfile{Type: "Custom", Custom: &CustomSpec{
		MinTLSVersion: "VersionTLS12",
		Ciphers:       []string{"AES128-GCM-SHA256"},
		Groups:        []string{"future-group"},
	}}, false))
	addr, stop := startTLS(t, r)
	defer stop()

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			RootCAs:      roots,
			ServerName:   "localhost",
			MinVersion:   tls.VersionTLS12,
			MaxVersion:   tls.VersionTLS12,
			CipherSuites: []uint16{tls.TLS_RSA_WITH_AES_128_GCM_SHA256},
			NextProtos:   []string{nextProtoH2, nextProtoHTTP11},
		},
		ForceAttemptHTTP2: true,
	}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 3 * time.Second}
	response, err := client.Get("https://" + addr)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNoContent || response.ProtoMajor != 1 {
		t.Fatalf("status=%d protocol=%s, want HTTP/1.1 204", response.StatusCode, response.Proto)
	}
}

// Locks the unusable-group handshake safeguard: fallback CipherSuites must be
// RSA key-exchange only (empty CurvePreferences still uses Go's ECDHE defaults).
// Also checks HTTP/1.1-only ALPN and MaxVersion capped at TLS 1.2.
func TestUnusableGroupsHandshakeConfigInvariant(t *testing.T) {
	r := NewReloader()
	r.Apply(fromProfile(SecurityProfile{Type: "Custom", Custom: &CustomSpec{
		MinTLSVersion: "VersionTLS12",
		Ciphers:       []string{"ECDHE-RSA-AES128-GCM-SHA256", "AES128-GCM-SHA256", "TLS_AES_128_GCM_SHA256"},
		Groups:        []string{"future-group"},
	}}, false))
	hello := &tls.ClientHelloInfo{SupportedVersions: []uint16{tls.VersionTLS12}}
	cfg, err := r.GetConfigForClient(hello)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.MaxVersion != tls.VersionTLS12 {
		t.Fatalf("MaxVersion 0x%x want TLS 1.2", cfg.MaxVersion)
	}
	if len(cfg.CipherSuites) == 0 {
		t.Fatal("CipherSuites empty; want at least one RSA key-exchange suite")
	}
	for _, id := range cfg.CipherSuites {
		if !isRSAKeyExchangeCipher(id) {
			t.Fatalf("CipherSuites %v; want only RSA key exchange", cfg.CipherSuites)
		}
	}
	if len(cfg.NextProtos) != 1 || cfg.NextProtos[0] != nextProtoHTTP11 {
		t.Fatalf("NextProtos %v; want http/1.1 only (h2 rejects TLS_RSA_*)", cfg.NextProtos)
	}
}
