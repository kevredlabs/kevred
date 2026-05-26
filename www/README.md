# kevred-www

React / TypeScript landing page. Served at the root domain (`kevred.io`). Links to `kevred-app` for authentication.

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
  --build-arg VITE_APP_URL=https://app.kevred.io \
  -t kevred-www .
docker run -p 80:80 kevred-www
```

## CI — build & publish image

Two separate builds for develop and prod — the "Log in" / "Get started" links point to different app environments:

| Environment | `VITE_APP_URL` baked in |
|---|---|
| develop | `https://app.dev.kevred.io` |
| prod | `https://app.kevred.io` |
