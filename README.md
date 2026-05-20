# kevred — Solana RPC Load Balancer

## Project overview

BYOK (Bring Your Own Keys) Solana RPC proxy. Users configure their own RPC provider API keys via a dashboard; the proxy dispatches their `sendTransaction` requests across those providers using round-robin, multiplying their effective rate limit at zero marginal cost.

The core value proposition is centralized RPC provider management with zero deployment overhead — not free-tier arbitrage. The round-robin dispatch is the mechanism; the dashboard is the product.

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
                    └── 3 failures → open 30s → retry → reclose
```

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
| Dashboard | Next.js (TypeScript) |
| Payments | Stripe Checkout + webhooks |
| Deploy | Wrangler CLI |

## V1 scope

In scope:
- CF Worker: round-robin dispatch across N providers per client
- Circuit breaker: detect failing providers, exclude temporarily
- Dashboard: BYOK config UI (add providers, paste API keys)
- Auth: simple token-based client identification

Out of scope for v1:
- Monitoring dashboard / metrics visualization
- Stripe integration
- WebSocket subscription load balancing
- Helius Sender integration (requires tip in tx — opt-in later)
- Cron health checks (add after core is stable)

## Key architectural decisions

**Round-robin, not scatter** — each tx goes to one provider, rotating. Scatter (send same tx to all providers) solves redundancy per tx, not throughput. We want throughput.

**Dispatch-only Worker, no retry loop inside** — the Worker selects provider, forwards, returns signature. Retry loop (poll `getSignatureStatuses` until `lastValidBlockHeight`) stays client-side. CF Workers CPU time limits make internal retry loops unreliable.

**Durable Objects for counters, not KV** — KV is eventually consistent, breaks atomic round-robin. One DO per client holds both the counter and the provider config. Simpler than KV + DO split at v1.

**BYOK model** — each user's API keys are their own. No ToS violation risk (we are not reselling provider access, we are proxying with the user's own credentials). Keys stored encrypted in the DO.

**Approximate state is acceptable** — CF Workers may spawn multiple V8 isolates; the DO is the source of truth for the counter. The Worker routes to the DO on every request. No state in the Worker itself.

## Long-term roadmap

- **Validator integration**: Kevredlabs operates a Solana validator. Route to own validator as primary provider long-term → eliminates dependency on third-party free tiers entirely and any ToS risk.
- **Helius Sender**: integrate as opt-in provider for tipped transactions (dual routing, 0 credits).
- **Monitoring**: per-provider metrics surfaced in dashboard.
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
