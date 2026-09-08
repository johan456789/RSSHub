---
title: Weekly RSSHub sync and deploy
description: >
  Managed by kimaki scheduled task. Do not move or delete this file
  without also updating the kimaki task (kimaki task list / kimaki task edit).
---

## Goal

Sync the fork (`master` from upstream `DIYgod/RSSHub`), rebase `myfork` onto it,
push `myfork`, and redeploy the local compose stack. Runs weekly.

## Steps (in order, each gated on the previous succeeding)

1. `just sync`
   - On failure: if a rebase is in progress, run `git rebase --abort`, confirm
     `git status` is clean, then STOP. Do not push or deploy.
2. `git fetch origin myfork && git push --force-with-lease origin myfork`
   - On failure: STOP. Do not deploy (deployed code would diverge from remote).
3. `just deploy` (default flags: prune enabled, no cache flush)
4. Verify: `docker compose ps` (all healthy) and
   `curl -s http://localhost:4573/healthz`

## Rules

- Work in `/home/han/Developer/RSSHub`. Bypass git precommit hooks with
  `--no-verify` if a commit is ever needed (normally none is).
- Never resolve rebase conflicts automatically. Abort and report.
- Never run steps 2–3 if step 1 failed. Never run step 3 if step 2 failed.

## Reporting

- Success: mention the user via a Discord user mention (resolve the ID from the
  session/scheduling metadata — never hardcode it) with a brief summary
  (new `myfork` HEAD SHA, services healthy) plus a user-facing changelog of
  upstream changes pulled in since the previous sync (grouped: new feeds,
  fixed feeds, notable infra). Derive the range from `master` reflog
  (previous vs current `master` SHA) and summarize `feat`/`fix` commits,
  omitting pure dependency bumps.
- Failure: mention the user the same way with the failed step
  and relevant logs so they can intervene.
