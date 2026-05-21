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
