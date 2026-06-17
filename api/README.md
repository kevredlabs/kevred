# kevred-api

Express / TypeScript REST API. Connects to MongoDB and exposes the backend endpoints consumed by the dashboard (`app`).

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 24 |
| Framework | Express 5 |
| Language | TypeScript 5 (compiled via `tsc`, dev via `tsx`) |
| Database | MongoDB (Mongoose) |

## Local development

```bash
cp .env.example .env   # fill MONGODB_URI, PORT, …
yarn install
yarn dev               # tsx watch — hot-reload on save
```

The server starts on `PORT` (default `3000`).

### MongoDB tunnel (GCP)

Forward port 27017 from the `app` VM to localhost:

```bash
gcloud compute ssh app --tunnel-through-iap -- -L 27017:localhost:27017 -N
```

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | Start with hot-reload (`tsx watch`) |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Run compiled output (`node dist/index.js`) |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default `3000`) | HTTP listen port |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs — use a 256-bit random string |
| `APP_URL` | Yes | Frontend origin (e.g. `http://localhost:5173`) — used for CORS and magic link URL |
| `MAILJET_API_KEY` | Yes | Mailjet API key |
| `MAILJET_SECRET_KEY` | Yes | Mailjet secret key |
| `MAIL_FROM_EMAIL` | Yes | Sender email address |
| `MAIL_FROM_NAME` | No (default `Kevred`) | Sender display name |
| `CF_ACCOUNT_ID` | Yes | Cloudflare account id — same value across envs |
| `CF_KV_NAMESPACE_ID` | Yes | Cloudflare KV namespace id — **different per env** (see below) |
| `CF_API_TOKEN` | Yes | Cloudflare API token with `Workers KV Storage: Edit` **and** `Account Analytics: Read` permissions |
| `CF_ANALYTICS_ENV` | No (default `dev`) | Selects the Analytics Engine dataset: `dev` → `rpc_requests_dev`, `prod` → `rpc_requests_prod` |
| `RPC_DOMAIN` | No (default `rpc-mainnet.dev.kevred.net`) | Domain suffix returned by `/auth/me` so the dashboard can display the user's endpoint as `{customerId}.{RPC_DOMAIN}` — **different per env** (see below) |

Two databases and two Cloudflare KV namespaces are in use — one per environment. The API must point at the namespace matching its environment, otherwise the dev API would write into the prod proxy's config (and vice versa).

| Environment | MongoDB database | Cloudflare KV namespace | `RPC_DOMAIN` | Worker route |
|---|---|---|---|---|
| develop | `kevred-develop` | dev KV namespace (see [`cloudflare-rpc/wrangler.toml`](https://github.com/kevredlabs/cloudflare-rpc/blob/main/wrangler.toml) `env.dev`) | `rpc-mainnet.dev.kevred.net` | `*.rpc-mainnet.dev.kevred.net` |
| prod | `kevred-prod` | prod KV namespace (see [`cloudflare-rpc/wrangler.toml`](https://github.com/kevredlabs/cloudflare-rpc/blob/main/wrangler.toml) `env.prod`) | `rpc-mainnet.kevred.net` | `*.rpc-mainnet.kevred.net` |

## Endpoints

### Auth

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/auth/magic-link` | No | Send a magic link to the given email (rate limited: 5 req / 15 min) |
| `GET` | `/auth/verify?token=xxx` | No | Validate the magic link token, set JWT cookie (rate limited: 20 req / 15 min) |
| `POST` | `/auth/logout` | No | Clear the JWT cookie |
| `GET` | `/auth/me` | Yes | Return the current user (`email`, `customerId`) |

The JWT is stored in an `HttpOnly; Secure; SameSite=Strict` cookie named `token`. Clients must send requests with `credentials: "include"`.

### Providers

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/providers` | Yes | Return the user's ordered provider list and their `customerId` |
| `PUT` | `/providers` | Yes | Replace the full provider list (add / remove / reorder / edit in one call) |

`PUT /providers` body: `{ "providers": [{ "label": "Helius mainnet", "url": "https://..." }, ...] }`

Validation: max 5 providers, HTTPS only, max 2 kB per URL, max 100 chars per label. Array order = priority (first = highest priority).

On success, the API writes `{ endpoints: [url1, url2, ...] }` to Cloudflare KV under `config:{customerId}` so the `cloudflare-rpc` Worker picks it up immediately. If the KV write fails, the response is `502` and the MongoDB state is intentionally kept — the user can retry.

### Metrics

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/metrics/summary` | Yes | End-to-end RPC metrics over the last 24h for the connected user: `{ requests, errorRate, p50Ms }` |
| `GET` | `/metrics/providers` | Yes | Per-upstream-provider metrics over the last 24h: `{ providers: [{ host, requests, errorRate, p50, p90, p99 }, ...] }` |

Both endpoints query the Cloudflare Analytics Engine dataset selected by `CF_ANALYTICS_ENV`. The `customerId` filter is derived from the session, never accepted from the client. All aggregates are weighted by `_sample_interval` to compensate for AE sampling.

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns API and MongoDB status |

## Docker

```bash
docker build -t kevred-api .
docker run -e MONGODB_URI=... -p 3000:3000 kevred-api
```

The Dockerfile compiles TypeScript at build time and runs the compiled output — no `tsx` or dev dependencies in the final image.

In production, the image is pulled and run on a GCP VM via Docker Compose.

## CI — build & publish image

**Workflow:** [`.github/workflows/api.yml`](../.github/workflows/api.yml)  
**Trigger:** push of a tag matching `api-v*.*.*`

```bash
git tag api-v1.2.3
git push origin api-v1.2.3
```

**Steps:**

1. Checks out the repo.
2. Builds the Docker image from `./api`.
3. Pushes to GHCR as `ghcr.io/kevredlabs/kevred-api` with two tags:
   - `latest` — always tracks the most recent publish
   - the exact tag name (e.g. `api-v1.2.3`)

There is a single environment (no prod/develop split). Authentication to GHCR uses the built-in `GITHUB_TOKEN` — no secrets to configure.
