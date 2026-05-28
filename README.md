# ghi

`ghi` turns rough engineering notes into GitHub issues that are useful to maintainers.

Give it a bug report, feature idea, terminal error, screenshot, mobile capture, or external report. It uses local repo context, Codex, GitHub CLI auth, and the repository's issue conventions to draft a polished issue or closure comment.

> Issue intake for developers who want GitHub-native operational memory without adding a project-management layer.

## What It Does

- Creates full GitHub issues from terse notes like `ghi "inventory dupes after reconnect"`.
- Uses local repository context and existing issue templates when available.
- Scores generated drafts for issue quality and asks Codex to revise weak drafts before creating them.
- Creates an `ai-draft` label when permissions allow.
- Stores hidden `ghi` metadata without exposing the rough original prompt in the issue body.
- Searches for possible duplicate or related issues and posts follow-up comments when confidence is high enough.
- Closes issues with full-context closure comments from short reason notes.
- Runs longer issue generation work in background jobs so agents can keep moving.
- Pairs the mobile app with a desktop repository through a local QR-code bridge.

## Install

Install the CLI globally:

```bash
npm install -g @ifbars/ghi
```

or:

```bash
bun install -g @ifbars/ghi
```

Then run `ghi` from inside a GitHub-backed repository.

## Requirements

- Node.js 20+
- Git
- GitHub CLI authenticated with access to the target repository
- A working local Codex session for `@openai/codex-sdk`
- Expo Go if you want to use the mobile app from source

Check local readiness:

```bash
ghi doctor
```

## Create Issues

Preview a generated issue without creating anything:

```bash
ghi --dry-run "settings screen does not preserve selected repo"
```

Create or review an issue:

```bash
ghi "memory leak in websocket reconnect"
ghi --now "inventory dupes after reconnect"
ghi --review "project cards are awkward after opening on mobile"
```

Add source context when the report comes from another surface:

```bash
ghi \
  --url "https://example.com/external-report" \
  --quote "Reporter says it crashes after enabling the optional patch" \
  --screenshot "C:\path\to\screenshot.png" \
  --explore \
  "turn this external report into a repo issue"
```

The final GitHub issue should read like a maintainer-ready report, not a cleaned-up transcript of your rough prompt.

## Background Jobs

Use `--async` when investigation may take a while or when another agent should continue working while `ghi` creates the issue.

```bash
ghi --async --explore "investigate recurring terminal build error"
ghi jobs
ghi job <id>
```

Machine-readable output is available for agentic workflows:

```bash
echo '{"summary":"Async worker loses the created issue URL","observed":"The job succeeds but polling has no URL.","expected":"Agents can poll job JSON and continue work.","filesTouched":["packages/cli/src/background/jobs.ts"],"confidence":0.7}' \
  | ghi create --async --from-stdin --json

ghi jobs --json
ghi job <id> --json
```

When `--from-stdin` receives JSON, `ghi` treats it as structured steering context. Codex still writes the final issue from repo context, templates, source evidence, and quality gates.

## Close Issues

Generate closure comments from short notes:

```bash
ghi close 42 "fixed by reconnect reconciliation patch"
ghi close 42 --duplicate-of 17 "same root cause and repro path"
ghi close 42 --dry-run "no longer applicable after mobile card redesign"
```

Use `--dry-run` or `--review` when you want to inspect the closure before mutating GitHub.

## Mobile Capture

The mobile app is a lightweight GitHub-aware capture client. It can browse repositories and issues, save local drafts, attach screenshots or files, and hand captures to the desktop CLI.

Mobile does not run Codex on iOS. For repo-aware generation, start a local bridge from the desktop repository that should receive the issue:

```bash
ghi mobile serve
```

The bridge prints a local URL, pairing token, pairing URL, and terminal QR code. In the mobile app, open Settings and scan the QR code. Once paired, Capture sends reports and attachments to the desktop bridge. The bridge returns a job id, stores uploaded evidence locally, and runs the Codex/GitHub workflow in the background.

The bridge is intentionally repo-local. If mobile selects a different repository than the desktop bridge is serving, the request is rejected instead of guessing another local checkout.

## Issue Quality

`ghi` is designed to create issues that are actionable, scoped, and easy to triage. Generated drafts are checked for:

- clear title and issue kind
- concrete repro or acceptance criteria
- expected and observed behavior for bugs
- environment, version, or platform details when relevant
- evidence such as logs, screenshots, links, or file references
- template fit and missing placeholder cleanup
- maintainer tone and scope control
- accidental leakage of rough prompt text, secrets, or AI disclosure prose

Low-scoring drafts are sent back through Codex with targeted feedback before creation.

## Issue Scoring Action

Repos can install the deterministic issue scorer without running Codex by adding this workflow:

```yaml
name: Score issues

on:
  issues:
    types: [opened, edited, reopened]

permissions:
  issues: write
  contents: read

jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - uses: ifBars/ghi@v1
        with:
          low-score-threshold: "6.6"
          comment-on-low-score: "true"
          apply-labels: "true"
```

The action scores the issue body on a `0.0`-`10.0` scale, adds labels such as `ghi-score/7.x` and `ghi-quality/usable`, and updates one guidance comment on low-scoring issues. It only uses the deterministic scorer in this repository; it does not call Codex, OpenAI APIs, or the full `ghi` issue-generation flow.

Useful inputs:

| Input | Default | Purpose |
| --- | --- | --- |
| `low-score-threshold` | `6.6` | Comment/fail threshold on the `0.0`-`10.0` scale. |
| `comment-on-low-score` | `true` | Add or update a guidance comment for low-scoring issues. |
| `apply-labels` | `true` | Add score and grade labels. |
| `score-label-prefix` | `ghi-score/` | Prefix for bucket labels like `ghi-score/7.x`. |
| `grade-label-prefix` | `ghi-quality/` | Prefix for labels like `ghi-quality/usable`. |
| `ignore-maintainer-authored` | `true` | Avoid commenting on low-scoring issues opened by owners, members, or collaborators. |
| `fail-on-low-score` | `false` | Fail the workflow when an issue is below threshold. |

## Safety Defaults

- Reads the current repository conservatively by default.
- Follows `.gitignore`.
- Avoids reading `.env` files.
- Does not put tokens, credentials, or raw rough prompts in issue bodies.
- Uses existing labels, templates, and repository conventions where possible.
- Puts duplicate or related-issue findings in follow-up comments, not the main issue body.

## Run From Source

This repository uses Bun for development:

```bash
bun install
bun run check
bun run test
bun run build
```

Run the CLI from source:

```bash
bun run dev:cli -- --dry-run "rough issue report"
```

Start the mobile app:

```bash
bun run dev:mobile
```

## Project Shape

`ghi` is local-first. The desktop CLI owns Codex and GitHub mutations. The mobile app is a capture surface that hands work to the desktop bridge.

The goal is low-friction GitHub issue capture and triage, not Jira, Linear, or a full project-management system.
