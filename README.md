# kevred — Solana RPC Load Balancer

## Project overview

BYOK (Bring Your Own Keys) Solana RPC proxy. Users configure their own RPC provider API keys via a dashboard in a prioritized order; the proxy forwards every request to the highest-priority healthy provider, failing over to the next one automatically when a provider goes down.

The core value proposition is centralized RPC provider management with zero deployment overhead. The priority-based failover is the V1 mechanism; the dashboard is the product.

**Increase reliability and quality of service** — by chaining multiple provider keys behind a single endpoint, clients get automatic failover when a provider degrades, without managing any infrastructure.

## Architecture

```
Client app
    │
    └── POST https://{clientId}.rpc-mainnet.kevred.net
              │
         CF Worker (TypeScript)
              │
              ├── read customer config ────────────► Cloudflare KV
              │     └── ordered list of provider endpoint URLs
              │
              ├── forward to first responding provider
              │     ├── Provider 1  ✓ → return response
              │     ├── Provider 2  ✓ → return response (if 1 returned 429/5xx)
              │     └── Provider 3  ✓ → return response (if 1+2 failed)
              │
              └── write analytics event ───────────► Cloudflare Analytics Engine
                    (customerId, endpoint used, status, latency)
```

**Dashboard**
```
User → dashboard.kevred.io
    ├── add/remove RPC providers + API keys (stored in KV)
    ├── view per-provider metrics (request count, error rate, latency)
    └── manage subscription (Stripe)
```

## Tech stack

| Layer | Choice |
|---|---|
| Proxy runtime | Cloudflare Workers (TypeScript) |
| Config per client | Cloudflare KV (ordered provider endpoint list) |
| Dashboard (frontend) | Vite + React (TypeScript) |
| Auth | Magic link (email OTP, JWT) |
| API | TypeScript / Express |
| Metrics | Cloudflare Analytics Engine (per-client request/endpoint/latency data, queried by the API) |
| Payments | Stripe Checkout + webhooks |
| Deploy | Wrangler CLI |

## V1 scope

In scope:
- CF Worker: priority-based failover across N providers per client — on 429/5xx, falls through to next provider in-flight
- Dashboard: BYOK config UI (add providers in priority order, paste API keys) + per-provider metrics (request count, error rate, latency)
- Auth: magic link (email OTP via JWT) + subdomain-based client identification for proxy requests

Out of scope for v1:
- Circuit breaker (N-failure exclusion, recovery probes)
- Round-robin dispatch (throughput scaling across providers)
- Stripe integration
- Google SSO
- WebSocket subscription load balancing

## Key architectural decisions

**Priority failover, not round-robin** — every request goes to provider #1; on 429/5xx the Worker falls through to provider #2, then #3, inline without a retry loop. Round-robin (rotating across all providers for throughput) is deferred to V2.

**Stateless Worker, config in KV** — no state in the Worker itself. Customer config (ordered endpoint list) is read from KV on each request. KV eventual consistency is acceptable here because the config changes rarely and a briefly stale read has no correctness impact — worst case a request hits a stale endpoint and falls over to the next.

**Dispatch-only Worker, no retry loop inside** — the Worker selects provider, forwards, returns response. Retry loop (poll `getSignatureStatuses` until `lastValidBlockHeight`) stays client-side. CF Workers CPU time limits make internal retry loops unreliable.

**BYOK model** — each user's API keys are their own. No ToS violation risk (we are not reselling provider access, we are proxying with the user's own credentials).

## Long-term roadmap

- **Circuit breaker (V2)**: track consecutive failures per provider; after N strikes exclude the provider for 30s, probe to recover. Requires Durable Objects (KV is eventually consistent — two Workers could read stale state and route to an excluded provider).
- **Round-robin dispatch (V3)**: rotate across all healthy providers to multiply effective throughput when a single provider's rate limit becomes the bottleneck.
- **Validator integration**: Kevredlabs operates a Solana validator. Route to own validator as primary provider long-term → eliminates dependency on third-party free tiers entirely and any ToS risk.
- **Stripe**: subscription plans gating number of providers, request volume, circuit breaker config.

## Development setup

```bash
# Worker
cd cloudflare-rpc
yarn install
yarn wrangler dev --env dev

# Deploy
yarn wrangler deploy --env dev
yarn wrangler deploy --env prod

# Tail production logs
yarn wrangler tail --env prod
```

## Team

- **Leo** — Solana backend, Worker implementation, provider integrations
- **Yves-Marie** — systems architecture, infrastructure, reliability

Both at Kevredlabs (Solana R&D lab, 2-person team).
