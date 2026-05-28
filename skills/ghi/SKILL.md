---
name: ghi
description: Use when a user wants to turn a rough bug report, feature idea, TODO, terminal error, stack trace, screenshot, external URL, Discord/community report, or agent-discovered issue into a scored, polished GitHub issue, or close an existing GitHub issue from a short reason with the local ghi CLI.
---

# ghi

Use `ghi` to create or close maintainer-ready GitHub issues from messy engineering input. It runs locally, uses the target repo as context, scores generated drafts for issue quality, and can create real issues labeled `ai-draft`.

## Operating Rules

- Run from the target git repository so `ghi` can detect repo, branch, commit, templates, labels, and conventions.
- Treat a non-`--dry-run` command as a live mutation: it can create or close a real GitHub issue.
- Use `--dry-run` unless the user explicitly asked to create/open/file the issue or has already approved live issue creation.
- Use `--async` for longer agentic exploration so the chat can continue while `ghi` works in the background.
- Redact secrets, tokens, `.env` contents, private keys, and credentials before passing quotes, screenshots, or issue text.
- Do not preserve the user's rough note verbatim unless it is necessary evidence. Transform it into a polished issue.
- Remember that Codex is the middle layer: give it structured context and steering, then let `ghi` turn that into a production-ready issue.

## Quick Commands

```powershell
ghi doctor
ghi --dry-run "rough report"
ghi create --review "rough report"
ghi --review "rough report"
ghi --now "rough report"
ghi "rough report"
ghi --async "rough report"
ghi --async --json "rough report"
ghi jobs
ghi jobs --json
ghi job <id>
ghi job <id> --json
ghi close 42 "fixed by reconnect reconciliation"
ghi close 42 "same root cause" --duplicate-of 17
ghi close 42 --dry-run "no longer applicable"
```

`ghi` creates the `ai-draft` label when needed. Related or duplicate issue context belongs in follow-up comments, not the main issue body.

## Structured Handoff

Use `--from-stdin` when another agent, script, or mobile handoff already has structured context:

```powershell
Get-Content .\issue-context.json | ghi create --from-stdin --dry-run
Get-Content .\issue-context.json | ghi create --from-stdin --async --json
```

Useful fields include `summary`, `kind`, `environment`, `steps`, `expected`, `actual`, `impact`, `evidence`, `attachments`, `links`, `acceptanceCriteria`, and `metadata`. Keep attachment evidence compact; prefer local paths, URLs, handles, or summaries over dumping large file contents when Codex can inspect them with tools.

## Quality Scoring

Generated create drafts are scored before issue creation. Weak drafts are revised with targeted feedback before they can be printed or created.

- Scores below the warning threshold produce revision guidance for missing repro, evidence, environment, expected/actual behavior, impact, or acceptance criteria.
- Blocking findings prevent rough user input, AI disclosure, or unfilled template residue from leaking into the final issue.
- The scorer lives in `packages/cli/src/intake/scoring.ts`.
- The harness command lives in `tools/score_issues.ts`.
- The checked corpora live in `tools/issue-corpus/`.

Use these commands when changing scoring or prompt behavior:

```powershell
bun run test:score
bun run score:issues:check
bun run score:issues:good
bun run score:issues:weak
bun run score:issues:rejected
bun run score:issues:audit
bun tools/score_issues.ts score tools/issue-corpus/production-good.jsonl --format json
bun tools/score_issues.ts collect --repo microsoft/typescript --repo facebook/react --state all --limit 100 --out .\tmp\issues.jsonl
```

Corpus intent:

- `scheduleone-good.jsonl` and `production-good.jsonl` should stay above the minimum good-issue gates.
- `scheduleone-weak.jsonl` should stay below the maximum weak-issue gates.
- `maintainer-rejected.jsonl` should stay below the rejected-issue gates and include curation evidence explaining maintainer rejection.

## Command Surface

Use the root command or `ghi create` for issue creation; they accept the same create flags:

| Flag | Use |
| --- | --- |
| `--now` | Create immediately as an `ai-draft` issue. |
| `--review` | Show terminal review before creating. |
| `--dry-run` | Print the generated issue payload without creating an issue. |
| `--async` | Enqueue a headless background job and return immediately. |
| `--json` | Print machine-readable async job metadata. |
| `--from-stdin` | Read rough text or structured JSON issue context from stdin. |
| `--url <url>` | Add an external source URL for Codex to inspect or cite. |
| `--quote <text>` | Add exact external report text as source context. |
| `--screenshot <path>` | Add a local screenshot/image path as visual evidence. |
| `--explore` | Allow deeper Codex source exploration with network/web tools when available. |
| `--no-fetch` | Do not prefetch URL text before handing URLs to Codex. |

Use lifecycle commands for non-creation work:

| Command | Use |
| --- | --- |
| `ghi doctor` | Check git, GitHub CLI, and Codex readiness. |
| `ghi jobs [--json]` | List background issue creation jobs. |
| `ghi job <id> [--json]` | View one background job and its log. |
| `ghi close <issue> [reason...]` | Close an issue with a Codex-generated closure comment. |
| `ghi mobile serve` | Start the local token-protected mobile bridge. |

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
   - Background job: add `--async`, and add `--json` when another agent needs machine-readable output.
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

## Validation

Run focused checks while iterating, then relevant full checks before release:

```powershell
bun run check
bun run test
bun run build
bun run smoke:node
bun run test:score
bun run score:issues:check
```

For CLI-only work:

```powershell
bun run --cwd packages/cli check
bun run --cwd packages/cli test
bun run --cwd packages/cli smoke:node
```

## Common Mistakes

- Wrong directory means wrong repository. Check `pwd` when paths are involved.
- Missing `--dry-run` can create a live issue. Preview when intent is ambiguous.
- Lost async job ids lose the result. Keep the id and poll with `ghi job <id>`.
- Raw note dumps defeat the product goal. Convert input into title, context, repro, expected behavior, actual behavior, impact, and acceptance criteria where applicable.
- Do not maintain a Python scorer; the scoring harness is TypeScript/Bun so it stays aligned with the CLI.
