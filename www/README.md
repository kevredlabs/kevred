# kevred-www

React / TypeScript landing page. Served at the root domain (`kevred.com`). Links to `kevred-app` for authentication.

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
yarn dev   # Vite dev server on http://localhost:5174
```

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | Vite dev server with HMR |
| `yarn build` | Type-check + production build to `dist/` |
| `yarn preview` | Serve the `dist/` build locally |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_APP_URL` | No (default `http://localhost:5173`) | Base URL of `kevred-app` — used for "Log in" and "Get started" links |

This variable is baked into the bundle at build time by Vite. It **must** be set at `docker build` time, not at container runtime.

## Docker

```bash
docker build \
  --build-arg VITE_APP_URL=https://app.kevred.com \
  -t kevred-www .
docker run -p 80:80 kevred-www
```

## CI — build & publish image

**Workflow:** [`.github/workflows/www.yml`](../.github/workflows/www.yml)  
**Trigger:** push of a tag matching `v*.*.*` (the same tag triggers `api` and `app` builds in parallel — see the root [`CLAUDE.md`](../CLAUDE.md)).

```bash
git tag v1.2.3
git push origin v1.2.3
```

**Two environments, one workflow — a matrix builds both in parallel:**

| Matrix env | `VITE_APP_URL` baked in | Docker tags pushed |
|---|---|---|
| `develop` | `https://app.develop.kevred.com` | `develop`, `1.2.3-develop` |
| `prod` | `https://app.kevred.com` | `latest`, `1.2.3-prod` |

**Steps:**

1. Checks out the repo.
2. Builds the Docker image from `./www` for each matrix entry, passing the matching `VITE_APP_URL` as a build-arg.
3. Pushes to GHCR as `ghcr.io/kevredlabs/kevred-www` with the tags above.

Authentication to GHCR uses the built-in `GITHUB_TOKEN` — no secrets to configure.
