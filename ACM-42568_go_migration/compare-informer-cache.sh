#!/usr/bin/env bash
# Copyright Contributors to the Open Cluster Management project
#
# ACM-42597 snapshot gate: compare Go informer cache vs Node (or a file dump).
# On ACM-42597+, GET /debug/informer-snapshot is served in non-production.
# Skips when the endpoint is 404 (older backends).
#
# Usage (npm run plugins already up):
#   ./compare-informer-cache.sh
#
# Optional:
#   CONTRACT_GO_SNAPSHOT_URL     default https://localhost:4000/debug/informer-snapshot
#   CONTRACT_NODE_SNAPSHOT_URL   Node dump URL (if instrumented)
#   CONTRACT_GO_SNAPSHOT_FILE    JSON file { "items": [ {apiVersion,kind,namespace,name} ] }
#   CONTRACT_NODE_SNAPSHOT_FILE  same shape for Node / kubectl dump
set -euo pipefail

cd "$(dirname "$0")"

export CONTRACT_BACKEND_URL="${CONTRACT_BACKEND_URL:-https://localhost:4000}"
if [[ -z "${CONTRACT_TOKEN:-}" ]]; then
  CONTRACT_TOKEN="$(oc whoami -t 2>/dev/null || true)"
  export CONTRACT_TOKEN
fi
export CONTRACT_GO_SNAPSHOT_URL="${CONTRACT_GO_SNAPSHOT_URL:-${CONTRACT_BACKEND_URL%/}/debug/informer-snapshot}"

echo "Go snapshot: ${CONTRACT_GO_SNAPSHOT_URL}"
if [[ -n "${CONTRACT_NODE_SNAPSHOT_URL:-}" ]]; then
  echo "Node snapshot URL: ${CONTRACT_NODE_SNAPSHOT_URL}"
fi
if [[ -n "${CONTRACT_NODE_SNAPSHOT_FILE:-}" ]]; then
  echo "Node snapshot file: ${CONTRACT_NODE_SNAPSHOT_FILE}"
fi

go test . -count=1 -timeout 2m -v -run 'TestCacheSnapshotSkipWhenMissing|TestWatchedResourcesMatchEventsTS'
