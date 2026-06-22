## Getting started

### 1. Add your provider keys

Go to **RPC Endpoints** in the sidebar and paste your API keys for the providers you want to use (Helius, QuickNode, Triton, etc.). Keys are never logged.

### 2. Pick a dispatch mode

In **Load Balancer**, choose between:

- **Sequential** — try providers one by one, fail over on errors.
- **Parallel** — race all providers, return the fastest response.

### 3. Copy your endpoint URL

Your endpoint is shown on the **Home** page:

```
https://<your-id>.rpc-mainnet.kevred.net
```

Swap it in wherever your client currently points to a specific provider. Send standard JSON-RPC requests as you would to any Solana RPC.
