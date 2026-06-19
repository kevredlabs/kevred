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
User → app.kevred.com
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
- CF Worker: two routing modes per client:
  - **sequential** — priority-based failover; every request goes to provider #1, falls through to #2 then #3 on `429/5xx`
  - **parallel** — fan out to all healthy providers simultaneously and return the first successful response (lowest latency, higher provider cost)
- CF Worker: circuit breaker per provider — after N consecutive failures the provider is excluded for a cooldown window and probed for recovery
- Dashboard: BYOK config UI (add providers in priority order, paste API keys, pick routing mode) + per-provider metrics (request count, error rate, latency, status-code distribution, timeseries)
- Auth: magic link (email OTP via JWT) + subdomain-based client identification for proxy requests

Out of scope for v1:
- Round-robin dispatch (throughput scaling across providers)
- Dedicated `sendTransaction` path (staked-connection sender, multi-region fan-out, retry until `lastValidBlockHeight`)
- Stripe integration
- Google SSO
- WebSocket subscription load balancing

## Key architectural decisions

**Two routing modes, no round-robin** — `sequential` (priority failover) and `parallel` (fan-out, first-success) cover the reliability vs. latency tradeoff. Round-robin (rotating across all providers for throughput) is deferred to V2.

**Stateless Worker, config in KV** — no state in the Worker itself. Customer config (ordered endpoint list) is read from KV on each request. KV eventual consistency is acceptable here because the config changes rarely and a briefly stale read has no correctness impact — worst case a request hits a stale endpoint and falls over to the next.

**Dispatch-only Worker, no retry loop inside** — the Worker selects provider, forwards, returns response. Retry loop (poll `getSignatureStatuses` until `lastValidBlockHeight`) stays client-side. CF Workers CPU time limits make internal retry loops unreliable.

**BYOK model** — each user's API keys are their own. No ToS violation risk (we are not reselling provider access, we are proxying with the user's own credentials).

## Long-term roadmap

- **Round-robin dispatch**: rotate across all healthy providers to multiply effective throughput when a single provider's rate limit becomes the bottleneck.
- **Dedicated `sendTransaction` path**: today, sends are forwarded like any other RPC method. A dedicated path would fan out to multiple landing endpoints (staked connections, regional senders) and optionally drive a server-side retry loop until `lastValidBlockHeight`, instead of leaving it client-side.
- **Stripe**: subscription plans gating number of providers, request volume, circuit breaker config.

## Repository layout

This monorepo contains four deployable services, including the Cloudflare Worker that implements the actual RPC proxy.

| Path | Service | Stack |
|---|---|---|
| [`api/`](api/) | Backend REST API (auth, providers, metrics) | Node.js 24 · Express 5 · MongoDB |
| [`app/`](app/) | Dashboard (authenticated) | React 19 · Vite 6 · nginx |
| [`www/`](www/) | Public landing page | React 19 · Vite 6 · nginx |
| [`cf-worker/`](cf-worker/) | Cloudflare Worker RPC proxy | Cloudflare Workers · TypeScript · Wrangler |

Each subdirectory has its own `README.md` with setup, env vars, endpoints and CI details.

The Worker reads each customer's ordered provider list and routing mode from Cloudflare KV (written by `kevred-api`) and dispatches each request according to that mode: `sequential` falls over to the next provider on `429/5xx`, `parallel` fans out to all providers and returns the first success. A per-provider circuit breaker excludes a provider after N consecutive failures and probes it back to life. Every attempt and end-to-end summary is written to Cloudflare Analytics Engine, which `kevred-api`'s `/metrics/*` endpoints query back. The Worker, the API and the dashboard are tightly coupled by the KV namespace and the Analytics Engine dataset.

## Development setup

```bash
# Backend API
cd api && yarn install && yarn dev

# Dashboard
cd app && yarn install && yarn dev

# Landing
cd www && yarn install && yarn dev

# Cloudflare Worker (RPC proxy)
cd cf-worker && yarn install && yarn dev
```

## Team

- **Leo** — Solana backend, Worker implementation, provider integrations
- **Yves-Marie** — systems architecture, infrastructure, reliability

Both at Kevredlabs (Solana R&D lab, 2-person team).
