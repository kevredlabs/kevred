# cloudflare-rpc — CLAUDE.md

## Package manager

Use **yarn** exclusively. Never use `npm` or `npx`.

```bash
yarn install          # install deps
yarn wrangler ...     # run wrangler via yarn
```

## Common commands

```bash
yarn wrangler dev --env dev                    # local dev server
yarn wrangler deploy --env dev                 # deploy to dev
yarn wrangler deploy --env prod                # deploy to prod
```

## KV operations

`--remote --preview false` is **required** — without `--remote`, wrangler v4 hits an empty local store and reports "Value not found".

```bash
# put a customer config (mode optional: "sequential" default, or "parallel")
yarn wrangler kv key put "config:{customer_id}" \
  '{"endpoints":["https://provider-1.com/key","https://provider-2.com/key"],"mode":"sequential"}' \
  --binding CONFIG --env dev --remote --preview false

# read a customer config
yarn wrangler kv key get "config:{customer_id}" --binding CONFIG --env dev --remote --preview false

# delete a customer config
yarn wrangler kv key delete "config:{customer_id}" --binding CONFIG --env dev --remote --preview false
```

To change only the mode while keeping endpoints, read-merge-write with `jq` and `--path` (avoids exposing keys on the command line):
```bash
yarn --silent wrangler kv key get "config:{customer_id}" --binding CONFIG --env dev --remote --preview false > /tmp/c.json
jq '.mode = "parallel"' /tmp/c.json > /tmp/c2.json
yarn --silent wrangler kv key put "config:{customer_id}" --path /tmp/c2.json --binding CONFIG --env dev --remote --preview false
rm /tmp/c.json /tmp/c2.json
```

## Environments

| | Dev | Prod |
|---|---|---|
| Worker name | `cloudflare-rpc-dev` | `cloudflare-rpc-prod` |
| Wrangler flag | `--env dev` | `--env prod` |
| Analytics dataset | `rpc_requests_dev` | `rpc_requests_prod` |

## Architecture

- **`src/index.ts`** — entry point: extracts `customerId` from subdomain, reads + validates the KV config; on a missing/invalid config it emits a `config_error` log and returns a JSON-RPC error envelope (404 unknown customer / 500 invalid JSON / 503 no endpoints); otherwise delegates to proxy
- **`src/proxy.ts`** — `proxyRequest`: routes per the customer's `mode`:
  - `sequential` (default) — try endpoints in priority order, fall back to the next on transient/provider-specific failures (5xx, 52x/530, 429, 408, 401/403, 404, network errors; `isFailureStatus` = `status >= 400`). One upstream request per call.
  - `parallel` — fan out to all healthy providers at once, fastest success wins, losers are cancelled. **N× upstream cost.**
  - **Deterministic client errors** (`400`/`413`/`414`/`422`/`431`, `isHardClientError`) are **not** retried: every provider rejects identical bytes the same way, so the worker returns the provider's real status (outcome `client_error`). Falling back here would waste N calls and mask the error behind a `503`, which clients treat as retriable → retry storm. The breaker is left untouched (the provider is healthy, it correctly rejected the request).
  Emits structured JSON logs per attempt + summary (see Observability), and writes Analytics Engine rows: `writeAttempt` per upstream attempt (`success`/`fallback`/`error`/`client_error` — `cancelled` and `skipped_open` excluded, they aren't real upstream outcomes) and `writeSummary` per client request (`success`/`all_failed`/`client_error`, end-to-end latency). The `blob7` discriminator (`attempt`/`summary`) separates the two.
  On success the winning upstream `Response` passes through untouched. When every upstream fails, returns a **JSON-RPC error envelope** (`{jsonrpc, error: {code: -32603}, id}`, the `id` echoed from the request body) with **HTTP 503** (transient/retriable) — never plain text, so web3.js/kit clients get a parseable error.
- **`src/breaker.ts`** — in-memory, per-isolate circuit breaker: opens a provider after 3 consecutive failures (30s cooldown) so it's skipped instead of retried. Best-effort (state is per-isolate, lost on eviction).
- **`src/types.ts`** — `Env` and `CustomerConfig` (`endpoints` + optional `mode`)
- **`wrangler.toml`** — two environments (`env.prod`, `env.dev`); routes on `kevred.net`; `[observability.logs]` enabled; KV IDs must be filled in after `kv namespace create`

## KV schema

Key: `config:{customer_id}` → JSON:
```json
{ "endpoints": ["https://provider-1.com/key", "https://provider-2.com/key"], "mode": "sequential" }
```

`endpoints` are in priority order (matters for `sequential`). `mode` is optional: `"sequential"` (default when absent) or `"parallel"`.

## Observability

Each request emits **both** structured JSON logs (Workers Logs, via `wrangler tail` or the dashboard) and Analytics Engine data points (queried via the AE SQL API to power the dashboard). Log events:

- **`rpc_attempt`** — per provider tried: `host` (API key stripped), `outcome` (`success` / `fallback` / `error` / `client_error` / `cancelled` / `skipped_open`), `status`, `ms`, `colo`, `clientTcpRtt`, `mode`
- **`rpc_summary`** — per request: winner `host`, `path` (sequential) or `engaged` (parallel), `totalMs`, `outcome`
- **`breaker_open`** — when a provider is taken out of rotation (3 consecutive failures)
- **`config_error`** — KV config missing or unusable: `customerId`, `reason` (`not_configured` / `invalid_json` / `no_endpoints`), `status` (logged only, not written to Analytics Engine)

```bash
yarn wrangler tail --env dev --format json | jq 'select(.evt=="rpc_summary")'
```

Analytics Engine schema (written by `writeAttempt` / `writeSummary` in `proxy.ts`). One dataset, two row types keyed by `blob7`:

| Field | `blob7 = 'attempt'` (per upstream call) | `blob7 = 'summary'` (per client request) |
|---|---|---|
| `blob1` | customer ID | customer ID |
| `blob2` | endpoint host (API key stripped) | winner host (`''` if all failed) |
| `blob3` | HTTP status string (`''` on network error) | client-facing HTTP status (winner status on success, `503` on all_failed) |
| `blob4` | outcome: `success` / `fallback` / `error` / `client_error` | outcome: `success` / `all_failed` / `client_error` |
| `blob5` | mode (`sequential` / `parallel`) | mode |
| `blob6` | colo | colo |
| `blob7` | `attempt` | `summary` |
| `double1` | attempt latency in ms | end-to-end latency in ms |
| `index1` | customer ID | customer ID |

The dashboard backend queries this via the AE SQL API. The ready-to-use queries (per-provider table, top cards), the SQL API request/response format, and the required token permission live in [README.md → Consuming the metrics](README.md#consuming-the-metrics-dashboard-backend) — that section is the single source of truth for consumers. Key gotcha: weight every aggregate by `_sample_interval` (AE samples high volume).

## First-time setup (dev instance)

1. `yarn wrangler login`
2. Create KV namespaces:
   ```bash
   # dev
   yarn wrangler kv namespace create CONFIG --env dev
   yarn wrangler kv namespace create CONFIG --env dev --preview
   # prod
   yarn wrangler kv namespace create CONFIG --env prod
   yarn wrangler kv namespace create CONFIG --env prod --preview
   ```
3. Copy the printed IDs into `wrangler.toml` under the relevant `[[env.*.kv_namespaces]]`
4. `yarn wrangler deploy --env dev` / `yarn wrangler deploy --env prod`
