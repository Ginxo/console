# Contract test framework (ACM-42590)

Isolated Go module. Black-box HTTP client against the running console backend (Node today, Go later). Not wired into root `package.json` or CI.

## Quick start (npm run plugins already running)

With `npm run plugins` up and `oc login` done:

```bash
cd ACM-42568_go_migration
./run-catalog.sh
```

Or manually:

```bash
cd ACM-42568_go_migration
export CONTRACT_BACKEND_URL=https://localhost:4000
export CONTRACT_TOKEN=$(oc whoami -t)
go test . -count=1 -timeout 15m -v -run TestCatalogAgainstBackend
```

**You only need the backend on :4000** (started by `npm run plugins`). You do **not** need OpenShift Console on :9000.

Quick check: `curl -sk https://localhost:4000/ping` → `200`.

`./run-catalog.sh` runs a **preflight** before tests: hub alignment (`oc whoami --show-server` vs `CLUSTER_API_URL` in `backend/.env`), TLS certs for HTTPS, and `GET /ping`. `CONTRACT_SKIP_PREFLIGHT=1` disables it.

At the end: colored summary — **Executed**, **OK** (green), **SOFT** (yellow), **FAIL** (red). **FAIL must be 0** for a green gate. **SOFT** skips are optional upstreams missing on your hub (normal on dev).

`./run-catalog.sh` shows the summary without every subtest line. Use `go test -v` for per-case detail. `NO_COLOR=1` disables colors.

## Prerequisites

- Hub: `oc login`
- Backend: `npm run plugins` from repo root (Go on `https://localhost:4000`, Node sidecar on `:4001`)
- Go 1.22+
- `backend/certs/` present (`npm run generate-certs`) when using HTTPS

## Troubleshooting

### Plugin UI redirects to `/dashboards`

`oc whoami --show-server` must match `CLUSTER_API_URL` in `backend/.env`. After `oc login` to a new hub, run `npm run setup:hub` and restart `npm run plugins`. The OpenShift Console plugin proxy on :9000 sends your token with `authorize: true`; a hub mismatch 401s authenticated routes and the frontend logs out.

### `tls: first record does not look like a TLS handshake`

`backend/certs/` is missing, or backends started before certs existed. Run `npm run generate-certs` and restart **both** Go and the Node sidecar (certs are read only at startup).

## What each layer validates

| Layer | Command | Gate for |
|-------|---------|----------|
| REST catalog | `./run-catalog.sh` | Phases 1–2 and later REST migrations. **FAIL: 0** |
| SSE `GET /events` | catalog `events-sse` | **ACM-42598** (still Node today) |
| SSE `GET /events/rbac` | catalog `events-rbac-sse` (soft) | Already Go; 404 skip if hitting sidecar-only |
| Watch spec parity | `go test -run TestWatchedResourcesMatchEventsTS` | YAML vs `events.ts` `definitions` |
| Cache snapshot | `./compare-informer-cache.sh` | **ACM-42597** informer cache |

## Snapshot harness (ACM-42597)

Compares normalized keys `{apiVersion,kind,namespace,name}`. Argo `polled` kinds are excluded. Authentication **is** included (cached, not fanned out on SSE).

```bash
cd ACM-42568_go_migration
./compare-informer-cache.sh
```

The test **skips** (not fail) when `GET /debug/informer-snapshot` is missing (Go cache not wired yet). After ACM-42597:

| Variable | Purpose |
|----------|---------|
| `CONTRACT_GO_SNAPSHOT_URL` | Default `{BACKEND}/debug/informer-snapshot` |
| `CONTRACT_NODE_SNAPSHOT_URL` | Optional Node dump URL |
| `CONTRACT_GO_SNAPSHOT_FILE` / `CONTRACT_NODE_SNAPSHOT_FILE` | JSON `{ "items": [...] }` |

Offline unit tests (`TestDiffSnapshots`, `TestExcludePolled`) always run.

## Alternative: through the OCP Console proxy

Only if you also run the full plugin stack with Console on :9000:

```bash
cd ACM-42568_go_migration
export CONTRACT_BACKEND_URL=http://localhost:9000
export CONTRACT_PATH_PREFIX=/api/proxy/plugin/mce/console/multicloud
export CONTRACT_TOKEN=$(oc whoami -t)
go test . -count=1 -timeout 15m
```

For day-to-day contract runs, use **:4000** (quick start above).

## Modes

| Env | Effect |
|-----|--------|
| `CONTRACT_MODE=assert` (default) | Check status, headers, JSON shape, SSE framing, WS upgrade |
| `CONTRACT_COMPARE_URL=https://...` | Replay **REST** cases against a second backend and diff. **Does not diff SSE or WebSocket** (ACM-42598 will add a shadow-diff). |
| `CONTRACT_RECORD=1` | Write captures under `testdata/recorded/` (gitignored) |

Other: `CONTRACT_SSE_TIMEOUT` (default 120s), `CONTRACT_HTTP_TIMEOUT` (default 60s), `CONTRACT_TLS_INSECURE` (default true), `CONTRACT_RECORD_DIR`.

## Catalog

YAML in `catalog/` — add a route = add a YAML case.

- `soft: true` — skip (not fail) when optional upstream is missing
- `alsoMulticloud: true` — also run with `/multicloud` prefix
- `kind: sse` / `kind: websocket` — streaming cases
- `auth: invalid` — fake Bearer for 401 cases

`catalog/watched-resources.yaml` is the watch-spec catalog: one entry per `events.ts` definition, including `labelSelector`, `fieldSelector`, `polled`, and `forwardEventsToClients`. `source: events-rbac` marks the Go-only ClusterRole informer.

See `QUIRKS.md` for Node behaviors Go should replicate.

## Layout

```text
ACM-42568_go_migration/
├── catalog/
├── run-catalog.sh              # preflight + full catalog + colored summary
├── compare-informer-cache.sh   # ACM-42597 snapshot gate
├── testdata/recorded/          # gitignored
├── *.go
├── go.mod
├── README.md
└── QUIRKS.md
```
