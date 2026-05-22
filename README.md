# kevred — Solana RPC Load Balancer

## Project overview

BYOK (Bring Your Own Keys) Solana RPC proxy. Users configure their own RPC provider API keys via a dashboard; the proxy dispatches their `sendTransaction` requests across those providers using round-robin, multiplying their effective rate limit at zero marginal cost.

The core value proposition is centralized RPC provider management with zero deployment overhead — not free-tier arbitrage. The round-robin dispatch is the mechanism; the dashboard is the product.

**Increase rate limit and quality of service with small additional cost** — by aggregating multiple provider keys behind a single endpoint, clients multiply their effective throughput and gain automatic failover when a provider degrades, without managing any infrastructure.

## Architecture

```
Client app
    │
    └── POST https://rpc.kevred.io/{client-token}
              │
         CF Worker (Rust/WASM)
              │
              ├── Durable Object (per client)
              │     └── atomic counter → provider index
              │
              ├── forward to providers[idx] with client's API key
              │     ├── Helius
              │     ├── QuickNode
              │     └── Triton / others
              │
              └── circuit breaker per provider
                    ├── transient error (timeout, 5xx, 429) → fail over to next provider in-flight
                    └── 3 consecutive failures → excluded 30s → recovering probe → healthy
```

**Circuit breaker timeline (example)**

Helius goes down for ~2 minutes, with two other providers (QuickNode, Triton) in the rotation:

| t | Event | Helius state |
|---|---|---|
| 0s | all good | healthy |
| 10s | req #1 → timeout (1/3) | healthy |
| 11s | req #2 → 502 (2/3) | healthy |
| 12s | req #3 → timeout (3/3) | **excluded** |
| 12–42s | no requests sent to Helius, rotation continues on QuickNode/Triton | excluded |
| 42s | 30s elapsed → 1 probe sent | recovering |
| 42s | probe → still timeout | **excluded** (another 30s) |
| 72s | new probe → 200 OK | **healthy**, rotation resumes |

Note: from t=10s to t=12s, per-request failover already routed those three failing requests to the next provider — clients saw three successful responses. The breaker counter incremented in parallel and excluded Helius at the third strike to stop wasting 1/N of future traffic on it.

**Dashboard (Next.js)**
```
User → dashboard.kevred.io
    ├── add/remove RPC providers + API keys (stored encrypted in DO/KV)
    ├── view per-provider metrics (request count, error rate, latency)
    └── manage subscription (Stripe)
```

## Tech stack

| Layer | Choice |
|---|---|
| Proxy runtime | Cloudflare Workers (Rust → WASM via `workers-rs`) |
| State per client | Cloudflare Durable Objects (atomic round-robin counter + provider config) |
| Dashboard (frontend) | Vite + React (TypeScript) |
| Auth | Magic link (email OTP, JWT) |
| API | TypeScript / Express |
| CF consumer | TypeScript service consuming Cloudflare events/actions (metrics, circuit breaker state) |
| Metrics | Cloudflare Analytics Engine (per-client request/error/latency data, queried by the API) |
| Payments | Stripe Checkout + webhooks |
| Deploy | Wrangler CLI |

## V1 scope

In scope:
- CF Worker: round-robin dispatch across N providers per client
- Circuit breaker: per-request failover on transient errors (timeout, 5xx, 429, conn refused) + N-failure provider exclusion for 30s. Retry caps at N-1 providers and is NOT triggered on RPC-level errors (invalid params, `BlockhashNotFound`, etc.) to avoid amplifying client mistakes.
- Dashboard: BYOK config UI (add providers, paste API keys) + per-provider metrics (request count, error rate, latency, breaker state)
- Auth: magic link (email OTP via JWT) + token-based client identification for proxy requests

Out of scope for v1:
- Stripe integration
- Google SSO
- WebSocket subscription load balancing
- Helius Sender integration (requires tip in tx — opt-in later)
- Cron health checks (add after core is stable)

## Key architectural decisions

**Round-robin, not scatter** — each tx goes to one provider, rotating. Scatter (send same tx to all providers) solves redundancy per tx, not throughput. We want throughput.

**Dispatch-only Worker, no retry loop inside** — the Worker selects provider, forwards, returns signature. Retry loop (poll `getSignatureStatuses` until `lastValidBlockHeight`) stays client-side. CF Workers CPU time limits make internal retry loops unreliable.

**Durable Objects for counters, not KV** — KV is eventually consistent: concurrent Workers in different regions can read the same stale counter value and route two requests to the same provider, breaking round-robin correctness. A DO is a single instance with serialized access — all writes are atomic and immediately visible. One DO per client holds both the round-robin counter and the encrypted provider config.

**BYOK model** — each user's API keys are their own. No ToS violation risk (we are not reselling provider access, we are proxying with the user's own credentials). Keys stored encrypted in the DO.

**Approximate state is acceptable** — CF Workers may spawn multiple V8 isolates; the DO is the source of truth for the counter. The Worker routes to the DO on every request. No state in the Worker itself.

## Long-term roadmap

- **Validator integration**: Kevredlabs operates a Solana validator. Route to own validator as primary provider long-term → eliminates dependency on third-party free tiers entirely and any ToS risk.
- **Helius Sender**: integrate as opt-in provider for tipped transactions (dual routing, 0 credits).
- **Stripe**: subscription plans gating number of providers, request volume, circuit breaker config.

## Development setup

```bash
# Worker (Rust)
cargo install worker-build
wrangler dev   # local dev with DO/KV simulation

# Dashboard (Next.js)
cd dashboard
npm install
npm run dev

# Deploy Worker
wrangler secret put ENCRYPTION_KEY
wrangler deploy

# Tail production logs
wrangler tail
```

## Team

- **Leo** — Solana backend, Worker implementation, provider integrations
- **Yves-Marie** — systems architecture, infrastructure, DO state design, reliability

Both at Kevredlabs (Solana R&D lab, 2-person team).
