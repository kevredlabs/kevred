# cloudflare-rpc

Cloudflare Worker powering the per-customer RPC load balancer for kevred.net.

Each customer gets a dedicated subdomain (e.g. `{clientId}.rpc-mainnet.kevred.net`) that proxies Solana RPC calls through their configured provider endpoints. Two routing modes per customer: **sequential** (try endpoints in priority order, fall back on any 4xx/5xx error) and **parallel** (fan out to all providers, fastest success wins). An in-memory circuit breaker takes failing providers out of rotation. On success the winning provider's response passes through untouched — as do deterministic client errors (HTTP `400`/`413`/`414`/`422`/`431`), which every provider would reject identically: the worker returns the provider's real status instead of falling back and masking it. Every other worker-generated error is a JSON-RPC error envelope rather than plain text, so clients never choke parsing the body: HTTP 503 when every provider fails, and 404 / 500 / 503 for config problems (unknown customer, invalid JSON, no endpoints). Every request emits structured logs (Workers Logs).

## Architecture

```
Client app
    │
    ▼
{clientId}.rpc-mainnet.kevred.net   (Cloudflare Worker)
    │
    ├─ 1. Read customer config ──────────────► Cloudflare KV
    │        (ordered list of endpoints)
    │
    ├─ 2. Forward request — mode: sequential (priority order) or parallel (fan-out)
    │        │
    │        ├─► Provider 1  ✓ → return response
    │        ├─► Provider 2  ✓ → return response (sequential: if 1 failed)
    │        └─► Provider 3  ✓ → return response (sequential: if 1+2 failed)
    │        (failing providers are skipped via an in-memory circuit breaker)
    │
    └─ 3. Emit structured logs ──────────────► Workers Logs (wrangler tail)
             (mode, providers tried, winner, latencies, status)
```

## What this repo covers

- **Cloudflare Worker** — request routing (fallback / race modes), per-provider circuit breaker, error handling
- **KV persistence** — per-customer config (ordered provider endpoints + routing mode), updated by the kevred API on each customer change
- **Observability** — structured JSON logs per request (Workers Logs / `wrangler tail`) **and** Analytics Engine data points, queried by the dashboard backend via the AE SQL API (see [Observability](#observability))

This repo does **not** include the kevred API or the dashboard — it is a standalone infrastructure component.

## Stack

| Component | Technology |
|---|---|
| Runtime | Cloudflare Workers |
| Config store | Cloudflare KV |
| Analytics | Cloudflare Analytics Engine |
| Tooling | Wrangler |

## Environments

| | Dev | Prod |
|---|---|---|
| Worker name | `cloudflare-rpc-dev` | `cloudflare-rpc-prod` |
| Route | `*.rpc-mainnet.dev.kevred.net` | `*.rpc-mainnet.kevred.net` |
| Analytics dataset | `rpc_requests_dev` | `rpc_requests_prod` |
| KV namespace | separate | separate |
| Deploy | `yarn wrangler deploy --env dev` | `yarn wrangler deploy --env prod` |

## Customer config shape

Each customer config is stored in KV under the key `config:{customer_id}`:

```json
{
  "endpoints": [
    "https://provider-1.example.com/<api-key>",
    "https://provider-2.example.com/<api-key>",
    "https://provider-3.example.com/<api-key>"
  ],
  "mode": "sequential"
}
```

The kevred API writes this key whenever a customer updates their provider configuration.

### Routing mode

`mode` is optional and controls how the worker routes each request:

- `sequential` (default, applied when `mode` is absent) — try endpoints in priority order, fall back on the next when one fails. **One** upstream request per call.
- `parallel` — fan out to all healthy endpoints at once and return the fastest success. **N× upstream cost** (provider credits and rate limits multiply).

Set endpoints and mode together (rewrites the full config):

```bash
yarn wrangler kv key put "config:1234" \
  '{"endpoints":["https://red.kevred.com","https://green.kevred.com"],"mode":"parallel"}' \
  --binding CONFIG --env dev --remote --preview false
```

Adding, updating, or removing an endpoint all work the same way — rewrite the full array via `wrangler kv key put`:

```bash
# dev
yarn wrangler kv key put "config:1234" \
  '{"endpoints":["https://red.kevred.com","https://green.kevred.com","https://blue.kevred.com"]}' \
  --binding CONFIG --env dev --remote --preview false

# prod
yarn wrangler kv key put "config:1234" \
  '{"endpoints":["https://red.kevred.com","https://green.kevred.com","https://blue.kevred.com"]}' \
  --binding CONFIG --env prod --remote --preview false
```

To read a customer config:

```bash
# dev
yarn wrangler kv key get "config:1234" --binding CONFIG --env dev --remote --preview false
# prod
yarn wrangler kv key get "config:1234" --binding CONFIG --env prod --remote --preview false
```

To delete a customer config entirely:

```bash
# dev
yarn wrangler kv key delete "config:1234" --binding CONFIG --env dev --remote --preview false

# prod
yarn wrangler kv key delete "config:1234" --binding CONFIG --env prod --remote --preview false
```

## Testing

```bash
# add a customer
yarn wrangler kv key put "config:1234" \
  '{"endpoints":["https://red.kevred.com","https://green.kevred.com","https://blue.kevred.com"]}' \
  --binding CONFIG --env dev --remote --preview false

# send a request
curl -X POST https://1234.rpc-mainnet.dev.kevred.net \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}'
```

## Observability

Each request emits **both** structured JSON logs (Workers Logs, for live debugging) and Analytics Engine data points (the queryable source that powers the customer dashboard).

```bash
# stream summaries live
yarn wrangler tail --env dev --format json | jq 'select(.evt=="rpc_summary")'
```

Log events:

| Event | When | Key fields |
|---|---|---|
| `rpc_attempt` | per provider tried | `host` (key stripped), `outcome` (`success`/`fallback`/`error`/`client_error`/`cancelled`/`skipped_open`), `status`, `ms`, `mode`, `colo`, `clientTcpRtt` |
| `rpc_summary` | per request | winner `host`, `path` (sequential) or `engaged` (parallel), `totalMs`, `outcome` |
| `breaker_open` | provider taken out of rotation | `host`, `failures` |
| `config_error` | KV config missing or unusable | `customerId`, `reason` (`not_configured` / `invalid_json` / `no_endpoints`), `status` |

### Analytics Engine schema

One dataset (`rpc_requests_dev` / `rpc_requests_prod`), two row types keyed by `blob7`:

| Field | `blob7 = 'attempt'` (per upstream call) | `blob7 = 'summary'` (per client request) |
|---|---|---|
| `blob1` | customer ID | customer ID |
| `blob2` | endpoint host (key stripped) | winner host (`''` if all failed) |
| `blob3` | HTTP status (`''` on network error) | client-facing HTTP status (winner status on success, `503` on all_failed) |
| `blob4` | `success`/`fallback`/`error`/`client_error` | `success`/`all_failed`/`client_error` |
| `blob5` | mode (`sequential`/`parallel`) | mode |
| `blob6` | colo | colo |
| `blob7` | `attempt` | `summary` |
| `double1` | attempt latency (ms) | end-to-end latency (ms) |
| `index1` | customer ID | customer ID |

`cancelled` and `skipped_open` attempts are **not** written to Analytics Engine — neither is a real upstream outcome (a cancelled loser would distort error rate; a skipped provider made no call). Both still appear in the `rpc_attempt` logs for live debugging.

`client_error` rows **are** written (the provider made a real, fast call) but are deliberately left out of the per-provider and top-card error rates below: a `400`/`413`/… is the caller's bad request, not a provider or infra failure. The queries already exclude them — the per-provider table filters `blob4 IN ('success','fallback','error')`, and the top-card error rate counts only `all_failed`.

### Consuming the metrics (dashboard backend)

Query the AE SQL API — the SQL string is the **raw request body**:

```
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql
Authorization: Bearer <token>
Content-Type: text/plain

<the SQL string>
```

> ⚠️ The token needs **Account → Account Analytics → Read**. This is a *different* permission from the "Edit Cloudflare Workers" deploy token — extend that token or create a read-only one.

Response shape:

```json
{
  "meta": [ { "name": "host", "type": "String" }, { "name": "requests", "type": "Float64" } ],
  "data": [ { "host": "rpc.helius.xyz", "requests": 1234, "p50": 72 } ],
  "rows": 1
}
```

Notes:
- **Weight every aggregate by `_sample_interval`** — AE samples high-volume datasets; raw `count()`/`avg()` under-report.
- Ingestion lag: a few seconds to ~1 min. Retention: 90 days.

**Per-provider table** (share / percentiles / error rate) — `attempt` rows, real calls only:

```sql
SELECT blob2 AS host,
       SUM(_sample_interval) AS requests,
       SUM(IF(blob4 != 'success', _sample_interval, 0)) / SUM(_sample_interval) AS error_rate,
       quantileWeighted(0.5)(double1, _sample_interval)  AS p50,
       quantileWeighted(0.9)(double1, _sample_interval)  AS p90,
       quantileWeighted(0.99)(double1, _sample_interval) AS p99
FROM rpc_requests_dev
WHERE blob1 = '{customer_id}' AND blob7 = 'attempt'
  AND blob4 IN ('success','fallback','error')
  AND timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY host
```

**Top cards** (total requests / end-to-end error rate / P50) — `summary` rows:

```sql
SELECT SUM(_sample_interval) AS requests,
       SUM(IF(blob4 = 'all_failed', _sample_interval, 0)) / SUM(_sample_interval) AS error_rate,
       quantileWeighted(0.5)(double1, _sample_interval) AS p50_ms
FROM rpc_requests_dev
WHERE blob1 = '{customer_id}' AND blob7 = 'summary'
  AND timestamp > NOW() - INTERVAL '24' HOUR
```

Which customer to query: the dashboard knows the customer's subdomain (`{customer_id}.rpc-mainnet.kevred.net`); `{customer_id}` is the `blob1` filter value above and the KV config key suffix.

## Installation

### Prerequisites

- Node.js 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)

### 0. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to find it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `dash.cloudflare.com` → My Profile → API Tokens → Create Token → template **"Edit Cloudflare Workers"** |
| `CLOUDFLARE_ACCOUNT_ID` | `dash.cloudflare.com` → select any domain → right sidebar |

Wrangler reads these automatically — no need for `wrangler login` in CI/CD.

### 1. Install dependencies

```bash
yarn install
```

### 2. Authenticate with Cloudflare

```bash
yarn wrangler login
```

This opens a browser window — log in with your Cloudflare account.

### 3. Create KV namespaces

Two sets of namespaces — one per environment:

```bash
# dev
yarn wrangler kv namespace create CONFIG --env dev
yarn wrangler kv namespace create CONFIG --env dev --preview

# prod
yarn wrangler kv namespace create CONFIG --env prod
yarn wrangler kv namespace create CONFIG --env prod --preview
```

Each command prints an `id`. Copy the four values into `wrangler.toml`:

```toml
[[env.dev.kv_namespaces]]
binding = "CONFIG"
id = "<dev id>"
preview_id = "<dev preview id>"

[[env.prod.kv_namespaces]]
binding = "CONFIG"
id = "<prod id>"
preview_id = "<prod preview id>"
```

### 4. Deploy

```bash
yarn wrangler deploy --env dev
yarn wrangler deploy --env prod
```
