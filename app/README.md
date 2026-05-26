# kevred-app

React / TypeScript dashboard (frontend). Communicates with `kevred-api` via `VITE_API_URL`.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 24 (build only) |
| Framework | React 19 |
| Bundler | Vite 6 |
| Language | TypeScript 5 |
| Serve | nginx (production image) |

## Local development

```bash
yarn install
yarn dev   # Vite dev server on http://localhost:5173
```

By default, `VITE_API_URL` falls back to `http://localhost:3000` (see [`src/api.ts`](src/api.ts)).

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | Vite dev server with HMR |
| `yarn build` | Type-check + production build to `dist/` |
| `yarn preview` | Serve the `dist/` build locally |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No (default `http://localhost:3000`) | Base URL of `kevred-api` |

This variable is baked into the bundle at build time by Vite. It **must** be set at `docker build` time, not at container runtime.

## Docker

```bash
docker build \
  --build-arg VITE_API_URL=https://api.kevred.com \
  -t kevred-app .
docker run -p 80:80 kevred-app
```

Multi-stage build: Vite compiles the app in the first stage, then the static `dist/` is copied into an `nginx:alpine` image. No Node.js at runtime.

In production, the image is pulled and run on a GCP VM via Docker Compose.

## CI — build & publish image

**Workflow:** [`.github/workflows/app.yml`](../.github/workflows/app.yml)  
**Trigger:** push of a tag matching `app-v*.*.*-prod` or `app-v*.*.*-develop`

```bash
# develop
git tag app-v1.2.3-develop
git push origin app-v1.2.3-develop

# production
git tag app-v1.2.3-prod
git push origin app-v1.2.3-prod
```

**Two environments, one workflow — tag suffix controls everything:**

| Tag suffix | `VITE_API_URL` baked in | Docker tags pushed |
|---|---|---|
| `-develop` | `https://api.develop.kevred.com` | `develop`, `app-v1.2.3-develop` |
| `-prod` | `https://api.kevred.com` | `latest`, `app-v1.2.3-prod` |

**Steps:**

1. Checks out the repo.
2. Builds the Docker image from `./app`, passing `VITE_API_URL` as a build-arg.
3. Pushes to GHCR as `ghcr.io/kevredlabs/kevred-app` with the two tags above.

Authentication to GHCR uses the built-in `GITHUB_TOKEN` — no secrets to configure.
