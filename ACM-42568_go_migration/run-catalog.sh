#!/usr/bin/env bash
# Copyright Contributors to the Open Cluster Management project
set -euo pipefail

cd "$(dirname "$0")"
MODULE_DIR="$(pwd)"
ROOT_DIR="$(cd "$MODULE_DIR/.." && pwd)"

export CONTRACT_BACKEND_URL="${CONTRACT_BACKEND_URL:-https://localhost:4000}"
if [[ -z "${CONTRACT_TOKEN:-}" ]]; then
  CONTRACT_TOKEN="$(oc whoami -t 2>/dev/null || true)"
  export CONTRACT_TOKEN
fi

TIMEOUT="${CONTRACT_TIMEOUT:-15m}"
BIN="${TMPDIR:-/tmp}/acm-42590-contract.test"

preflight() {
  if [[ "${CONTRACT_SKIP_PREFLIGHT:-}" == "1" ]]; then
    echo "Preflight skipped (CONTRACT_SKIP_PREFLIGHT=1)"
    return 0
  fi

  if [[ -x "$ROOT_DIR/scripts/check-hub-alignment.sh" ]]; then
    "$ROOT_DIR/scripts/check-hub-alignment.sh"
  else
    ENV_FILE="${ROOT_DIR}/backend/.env"
    if command -v oc >/dev/null 2>&1; then
      OC_SERVER="$(oc whoami --show-server 2>/dev/null || true)"
      if [[ -n "$OC_SERVER" && -f "$ENV_FILE" ]]; then
        CLUSTER_API_URL="$(grep -E '^CLUSTER_API_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
        OC_SERVER="${OC_SERVER%/}"
        CLUSTER_API_URL="${CLUSTER_API_URL%/}"
        if [[ -n "$CLUSTER_API_URL" && "$OC_SERVER" != "$CLUSTER_API_URL" ]]; then
          cat >&2 <<EOF
error: backend hub mismatch

  oc context:    ${OC_SERVER}
  backend/.env:  ${CLUSTER_API_URL}

The OpenShift Console on :9000 forwards your oc login token with authorize=true.
When CLUSTER_API_URL points at a different hub, authenticated routes return 401
and the plugin UI redirects to /dashboards.

Fix: oc login to the hub cluster, then run: npm run setup:hub
EOF
          exit 1
        fi
      fi
    fi
    CERT_DIR="${ROOT_DIR}/backend/certs"
    if [[ "$CONTRACT_BACKEND_URL" == https://* ]] && [[ ! -f "${CERT_DIR}/tls.crt" || ! -f "${CERT_DIR}/tls.key" ]]; then
      cat >&2 <<EOF
error: backend TLS certs missing (${CERT_DIR}/tls.{crt,key})

The plugin proxy and CONTRACT_BACKEND_URL expect HTTPS on :4000. Without certs
the Go listener serves plain HTTP and clients fail with:
  tls: first record does not look like a TLS handshake

Fix: npm run generate-certs
Then restart npm run plugins (Go and the Node sidecar read certs only at startup).
EOF
      exit 1
    fi
  fi

  ping_url="${CONTRACT_BACKEND_URL%/}/ping"
  http_code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 "$ping_url" || true)"
  if [[ "$http_code" != "200" ]]; then
    cat >&2 <<EOF
error: backend not reachable at ${CONTRACT_BACKEND_URL} (GET /ping -> ${http_code:-curl-failed})

Quick check: curl -sk ${ping_url}
Start npm run plugins from the repo root. You only need the backend on :4000
(OpenShift Console on :9000 is optional).

If the URL is https:// and curl reports a TLS handshake error, run:
  npm run generate-certs
and restart npm run plugins.
EOF
    exit 1
  fi
}

echo "Backend: $CONTRACT_BACKEND_URL"
preflight

echo "Building test binary..."
go test -c -o "$BIN" .

echo "Running full catalog (TestCatalogAgainstBackend)..."
"$BIN" -test.timeout="$TIMEOUT" -test.run=TestCatalogAgainstBackend
