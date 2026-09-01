#!/usr/bin/env bash
# Copyright Contributors to the Open Cluster Management project
set -euo pipefail

cd "$(dirname "$0")"

export CONTRACT_BACKEND_URL="${CONTRACT_BACKEND_URL:-https://localhost:4000}"
if [[ -z "${CONTRACT_TOKEN:-}" ]]; then
  CONTRACT_TOKEN="$(oc whoami -t 2>/dev/null || true)"
  export CONTRACT_TOKEN
fi

TIMEOUT="${CONTRACT_TIMEOUT:-15m}"
BIN="${TMPDIR:-/tmp}/acm-42590-contract.test"

echo "Backend: $CONTRACT_BACKEND_URL"
echo "Building test binary..."
go test -c -o "$BIN" .

echo "Running full catalog (TestCatalogAgainstBackend)..."
"$BIN" -test.timeout="$TIMEOUT" -test.run=TestCatalogAgainstBackend
