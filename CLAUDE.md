# Project Instructions

## GitHub workflow

`gh` is configured and available. Follow this workflow for every task:

1. Check that a GitHub issue exists: `gh issue list`
2. If no issue exists, ask: "There's no issue for this — should I create one?" Never start coding without a reference issue.
3. Create a branch: `git checkout -b feat/short-name`
4. Code the task.
5. **Before committing: show the diff and ask the user to review before proceeding.** Never commit without explicit approval.
6. Commit using conventional commits: `feat: description`
7. Push: `git push origin feat/short-name`
8. Open a PR: `gh pr create --title "..." --body "Closes #XX"`
9. Announce the PR is ready for review.

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

A single tag `v*.*.*` triggers all 5 image builds in parallel:
- `kevred-api:<version>`
- `kevred-app:<version>-prod` and `kevred-app:<version>-develop`
- `kevred-www:<version>-prod` and `kevred-www:<version>-develop`

**Process when the user asks to push a tag:**

1. Fetch the latest tags:
   ```bash
   git tag --list 'v*' --sort=-version:refname | head -5
   ```
2. Determine the next version:
   - New feature → bump **minor** (`1.0.0` → `1.1.0`)
   - Bug fix → bump **patch** (`1.0.0` → `1.0.1`)
   - If unclear, ask: "Is this a feature (minor) or a fix (patch)?"
3. Propose the tag: e.g. `v1.1.0` — confirm before pushing.
4. Push the tag:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

Since every tag publishes to prod, always require explicit confirmation before pushing.

## Browser automation

`agent-browser` is installed globally (https://github.com/vercel-labs/agent-browser).

Use it whenever the user asks to verify, test, or inspect the frontend — navigating pages, submitting forms, checking redirects, reading cookies, taking screenshots. Prefer `snapshot` to understand the page structure, `eval` for session/cookie inspection, and `screenshot` as evidence.

```bash
agent-browser open http://localhost:5173
agent-browser snapshot
agent-browser screenshot /tmp/shot.png
agent-browser eval "(async () => { const r = await fetch('/api/auth/me', {credentials:'include'}); return r.status })()"
```
