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

Two databases are in use — one per environment:

| Environment | Database |
|---|---|
| develop | `kevred-develop` |
| prod | `kevred-prod` |

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
