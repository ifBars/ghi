---
name: ghi
description: Use when a user wants to turn a rough bug report, feature idea, TODO, terminal error, stack trace, screenshot, external URL, Discord/community report, or agent-discovered issue into a polished GitHub issue, or close an existing GitHub issue from a short reason with the local ghi CLI.
---

# ghi

Use `ghi` to create or close maintainer-ready GitHub issues from messy engineering input. It runs locally, uses the target repo as context, and can create real issues labeled `ai-draft`.

## Operating Rules

- Run from the target git repository so `ghi` can detect repo, branch, commit, templates, labels, and conventions.
- Treat a non-`--dry-run` command as a live mutation: it can create or close a real GitHub issue.
- Use `--dry-run` unless the user explicitly asked to create/open/file the issue or has already approved live issue creation.
- Use `--async` for longer agentic exploration so the chat can continue while `ghi` works in the background.
- Redact secrets, tokens, `.env` contents, private keys, and credentials before passing quotes, screenshots, or issue text.
- Do not preserve the user's rough note verbatim unless it is necessary evidence. Transform it into a polished issue.

## Quick Commands

```powershell
ghi doctor
ghi --dry-run "rough report"
ghi create --review "rough report"
ghi --review "rough report"
ghi --now "rough report"
ghi "rough report"
ghi --async "rough report"
ghi close 42 "fixed by reconnect reconciliation"
ghi close 42 "same root cause" --duplicate-of 17
ghi close 42 --dry-run "no longer applicable"
ghi jobs
ghi job <id>
```

`ghi` creates the `ai-draft` label when needed. Related or duplicate issue context belongs in follow-up comments, not the main issue body.

## Command Surface

Use the root command or `ghi create` for issue creation; they accept the same create flags:

| Flag | Use |
| --- | --- |
| `--now` | Create immediately as an `ai-draft` issue. |
| `--review` | Show terminal review before creating. |
| `--dry-run` | Print the generated issue payload without creating an issue. |
| `--async` | Enqueue a headless background job and return immediately. |
| `--url <url>` | Add an external source URL for Codex to inspect or cite. |
| `--quote <text>` | Add exact external report text as source context. |
| `--screenshot <path>` | Add a local screenshot/image path as visual evidence. |
| `--explore` | Allow deeper Codex source exploration with network/web tools when available. |
| `--no-fetch` | Do not prefetch URL text before handing URLs to Codex. |

Use lifecycle commands for non-creation work:

| Command | Use |
| --- | --- |
| `ghi doctor` | Check git, GitHub CLI, and Codex readiness. |
| `ghi jobs` | List background issue creation jobs. |
| `ghi job <id>` | View one background job and its log. |
| `ghi close <issue> [reason...]` | Close an issue with a Codex-generated closure comment. |

`ghi close` accepts these flags:

| Flag | Use |
| --- | --- |
| `--duplicate-of <issue>` | Mark the issue as a duplicate of another issue number or URL. |
| `--state-reason <reason>` | Set GitHub close reason: `completed`, `not-planned`, or `duplicate`. |
| `--review` | Review the generated closure comment before closing. |
| `--dry-run` | Print the generated closure payload without closing the issue. |

## Workflow

1. Confirm the target repository:
   - If the user gave a path, run from that path.
   - If already inside the repo, stay there.
   - If auth or repo state is uncertain, run `ghi doctor`.
2. Choose mode:
   - Preview only: `ghi --dry-run "..."`
   - Human terminal review: `ghi --review "..."`
   - Approved live issue: `ghi "..."` or `ghi --now "..."`
   - Background job: add `--async`.
3. For async jobs, keep the returned job id and check `ghi job <id>` until `completed` or `failed`.
4. Report the GitHub issue URL for live runs, or summarize the generated title/body/gaps for dry runs.

## Closing Issues

Use `ghi close` only with an explicit issue number or URL:

```powershell
ghi close 42 --dry-run "no longer applicable after the redesign"
ghi close 42 --review "fixed by responsive project detail layout"
ghi close 42 "same root cause and repro path" --duplicate-of 17
ghi close 42 "intentionally not planned" --state-reason not-planned
```

- Use short reason notes as positional text; `ghi` turns them into a full closure comment.
- Use `--duplicate-of <issue>` when the closure is a duplicate; `ghi` passes GitHub's native duplicate flag.
- Use `--state-reason completed|not-planned|duplicate` when the GitHub close reason should be explicit.
- Use `--dry-run` to print the generated closure payload without closing.
- Use `--review` to approve the generated closure comment before closing.
- Prefer `--dry-run` or `--review` unless the user clearly asked to close the issue.

## External Sources

Use source flags when the report comes from another surface:

```powershell
ghi --dry-run --url "<source-url>" --quote "<exact report excerpt>" --explore "diagnose and draft a maintainer-ready issue"
ghi --async --url "<source-url>" --quote "<exact report excerpt>" --explore "diagnose and create an ai-draft issue"
ghi --dry-run --screenshot "<absolute-image-path>" "mobile layout bug in project cards"
```

- Use `--url` for GitHub, Nexus Mods, Discord exports, support tickets, docs, or issue threads.
- Use `--quote` for the exact external report excerpt that should anchor the issue.
- Use `--screenshot` only with a local image path.
- Use `--explore` when the agent should inspect more context before drafting.
- Use `--no-fetch` when the URL is auth-gated, sensitive, or should only be passed through.

## Common Mistakes

- Wrong directory means wrong repository. Check `pwd` when paths are involved.
- Missing `--dry-run` can create a live issue. Preview when intent is ambiguous.
- Lost async job ids lose the result. Keep the id and poll with `ghi job <id>`.
- Raw note dumps defeat the product goal. Convert input into title, context, repro, expected behavior, actual behavior, impact, and acceptance criteria where applicable.
