# Project Instructions

## GitHub workflow

`gh` is configured and available. Follow this workflow for every task:

1. Check that a GitHub issue exists: `gh issue list`
2. If no issue exists, ask: "There's no issue for this — should I create one?" Never start coding without a reference issue.
3. Create a branch: `git checkout -b feat/short-name`
4. Code the task.
5. Commit using conventional commits: `feat: description`
6. Push: `git push origin feat/short-name`
7. Open a PR: `gh pr create --title "..." --body "Closes #XX"`
8. Announce the PR is ready for review.

Never merge PRs. Merging is done by a human after review.

## Commit style

- Conventional commits format: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Lowercase, imperative mood, max 72 characters (e.g. "feat: add X", "fix: Y").
- One commit per logical change. In English.

## Package manager

Always use `yarn`. Never use `npm install`, `npm run`, or any other npm commands.

## README

Update the relevant README(s) in each PR if the change affects setup, configuration, environment variables, or exposed endpoints.

## Releasing (pushing a tag to trigger CI)

Each service has its own tag namespace: `api-v*`, `app-v*`, `www-v*`.

- `app` and `www` require an environment suffix: `-develop` or `-prod`
- `api` has a single environment — no suffix

**Process when the user asks to push a tag:**

1. Fetch the latest tags for the relevant service:
   ```bash
   git tag --list '<service>-v*' --sort=-version:refname | head -5
   ```
2. Determine the next version:
   - If the changes add a new feature → bump **minor** (`1.0.0` → `1.1.0`)
   - If the changes is a bug fix → bump **patch** (`1.0.0` → `1.0.1`)
   - If unclear, ask: "Is this a feature (minor) or a fix (patch)?"
3. Propose the tag: e.g. `www-v1.1.0-develop` — confirm before pushing.
4. Push the tag:
   ```bash
   git tag www-v1.1.0-develop
   git push origin www-v1.1.0-develop
   ```

Never push a `-prod` tag without explicit confirmation from the user.
