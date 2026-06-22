## What is the goal?

Kevred exists to remove the single biggest source of fragility in any Solana app: depending on one RPC provider.

Any provider — Helius, QuickNode, Triton — can rate-limit, throttle, or simply break. You only find out under load, and by then your users are already hitting errors.

Kevred dispatches every RPC call across the providers **you** bring keys for. Pick **sequential** mode for automatic failover, or **parallel** mode to race them and return the fastest response.

You get one endpoint URL. We handle the rest.
