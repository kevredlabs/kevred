## How it works

Kevred runs entirely on **Cloudflare's edge network**. There is no origin server, no database to scale, no region to choose. Every request hits the closest of Cloudflare's 300+ data centers.

### The stack

- **Cloudflare Workers**:  the load balancer logic. Sub-10ms cold start, ~8ms median overhead vs. calling a provider directly.
- **Cloudflare KV**: stores each customer's ordered list of provider endpoints and routing mode (sequential or parallel).
- **Cloudflare Analytics Engine**: append-only metrics store. Every request emits one event (customer, provider used, status code, latency). This is what powers the Analytics page.

### Sequential mode

Try providers one by one in order. Only move to the next if the current one returns a 429 or 5xx. Optimised for **reliability** and lowest cost (no wasted upstream calls).

```
Client ──► CF Worker
              │
              ├── read customer config ───► Cloudflare KV
              │     └── ordered list of provider endpoint URLs
              │
              ├─► Provider 1   ✗ 429/5xx
              │
              ├─► Provider 2   ✗ 429/5xx
              │
              ├─► Provider 3   ✓ → return response
              │
              └── write analytics event ──► Cloudflare Analytics Engine
                    (customerId, endpoint used, status, latency)
```

### Parallel mode

Fire all providers at once. Return the first successful response, cancel the others mid-flight. Optimised for **speed** — your client sees the fastest provider's latency, every time.

```
Client ──► CF Worker
              │
              ├── read customer config ───► Cloudflare KV
              │     └── ordered list of provider endpoint URLs
              │
              ├─► Provider 1  ────┐
              │                   │
              ├─► Provider 2  ────┼──► first success → return
              │                   │    (others cancelled)
              ├─► Provider 3  ────┘
              │
              └── write analytics event ──► Cloudflare Analytics Engine
                    (customerId, endpoint used, status, latency)
```

### Circuit breaker

Common to both modes. The worker keeps an in-memory failure count per provider. After **3 consecutive failures**, the provider is taken out of rotation for **30 seconds** — requests skip it entirely instead of paying the latency to discover it's still down. On the first success after the cooldown, the breaker closes and the counter resets.

This means: a provider that briefly chokes (a bad deploy on their side, a regional incident) gets sidelined automatically. You don't pay for its failures repeatedly, and your client doesn't either.
