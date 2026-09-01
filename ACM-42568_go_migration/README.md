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

**You only need the Node backend on :4000** (started by `npm run plugins`). You do **not** need OpenShift Console on :9000.

Quick check: `curl -sk https://localhost:4000/ping` → `200`.

At the end: colored summary — **Executed**, **OK** (green), **SOFT** (yellow), **FAIL** (red). **FAIL must be 0** for a green gate. **SOFT** skips are optional upstreams missing on your hub (normal on dev).

`./run-catalog.sh` shows the summary without every subtest line. Use `go test -v` for per-case detail. `NO_COLOR=1` disables colors.

## Prerequisites

- Hub: `oc login`
- Backend: `npm run plugins` from repo root (Node on `https://localhost:4000`)
- Go 1.22+

## Alternative: through the OCP Console proxy

Only if you also run the full plugin stack with Console on :9000:

```bash
cd ACM-42568_go_migration
export CONTRACT_BACKEND_URL=http://localhost:9000
export CONTRACT_PATH_PREFIX=/api/proxy/plugin/mce/console/multicloud
export CONTRACT_TOKEN=$(oc whoami -t)
go test . -count=1 -timeout 15m
```

For day-to-day contract runs against Node, use **:4000** (quick start above).

## Modes

| Env | Effect |
|-----|--------|
| `CONTRACT_MODE=assert` (default) | Check status, headers, JSON shape, SSE framing, WS upgrade |
| `CONTRACT_COMPARE_URL=https://...` | Replay REST cases against a second backend and diff |
| `CONTRACT_RECORD=1` | Write captures under `testdata/recorded/` (gitignored) |

Other: `CONTRACT_SSE_TIMEOUT` (default 120s), `CONTRACT_HTTP_TIMEOUT` (default 60s), `CONTRACT_TLS_INSECURE` (default true), `CONTRACT_RECORD_DIR`.

## Catalog

YAML in `catalog/` — add a route = add a YAML case.

- `soft: true` — skip (not fail) when optional upstream is missing
- `alsoMulticloud: true` — also run with `/multicloud` prefix
- `kind: sse` / `kind: websocket` — streaming cases
- `auth: invalid` — fake Bearer for 401 cases

See `QUIRKS.md` for Node behaviors Go should replicate.

## Layout

```text
ACM-42568_go_migration/
├── catalog/
├── run-catalog.sh     # full catalog + colored summary
├── testdata/recorded/   # gitignored
├── *.go
├── go.mod
├── README.md
└── QUIRKS.md
```
