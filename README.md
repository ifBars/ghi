# ghi

`ghi` is AI-native GitHub issue intake for developers.

It turns rough bug reports, feature ideas, screenshots, logs, and mobile notes into polished GitHub issues and closure comments using local repo context.

> CodeRabbit for opening and triaging issues, not reviewing PRs.

## What It Does

- Creates full GitHub issues from terse notes like `ghi "inventory dupes after reconnect"`.
- Uses Codex locally to inspect the repository and follow project conventions.
- Applies existing issue templates when available.
- Creates an `ai-draft` label when needed.
- Adds hidden `ghi` metadata without putting the rough original input in the issue body.
- Searches after creation for possible duplicates or related issues and comments when confidence is high enough.
- Closes issues with full context closure comments from short reason notes.
- Runs long issue generation jobs in the background.
- Pairs the mobile app with a desktop repo through a local QR-code bridge.

## Product Shape

`ghi` is intentionally not Jira, Linear, or project-management ceremony. The goal is low-friction operational memory for developers:

- capture quickly
- let the local agent inspect the repo
- create a real GitHub issue
- keep the final issue useful for maintainers

`ghi` is local-first. The desktop CLI owns Codex and GitHub mutations. The mobile app is a lightweight GitHub-aware capture client that can browse repos/issues and hand new captures to the desktop CLI.

## Workspace

```text
packages/cli      Codex + GitHub CLI workflow
packages/shared   Shared intake primitives
apps/mobile       Expo iOS app for GitHub browsing and mobile capture
docs              Product notes, plans, and demo material
skills/ghi        Codex skill for agents using the local ghi CLI
```

## Requirements

- Bun
- Git
- GitHub CLI authenticated with access to the target repo
- A working local Codex session for `@openai/codex-sdk`
- Expo Go for the mobile app

## Install

Install the CLI globally so `ghi` is available on PATH:

```bash
npm install -g @ifbars/ghi
```

or:

```bash
bun install -g @ifbars/ghi
```

You can also install directly from a GitHub release tarball:

```bash
npm install -g https://github.com/ifBars/ghi/releases/download/v0.2.0/ifbars-ghi-0.2.0.tgz
```

Then run `ghi` from inside a GitHub-backed repository.

## Run Locally

```bash
bun install
bun run check
bun run test
bun run build
```

Link the CLI locally:

```bash
cd packages/cli
bun link
```

## Release

CLI releases are published as the npm package `@ifbars/ghi`, which installs the `ghi` binary.

Release flow:

1. Bump `packages/cli/package.json`.
2. Commit the version change.
3. Push a tag like `v0.1.1`.
4. The release workflow builds, tests, packs, creates a GitHub release tarball, and publishes to npm when `NPM_TOKEN` is configured.

## CLI Usage

Create an issue from rough text:

```bash
ghi "memory leak in websocket reconnect"
ghi --now "inventory dupes after reconnect"
ghi --review "project cards are awkward after opening on mobile"
```

Dry-run without creating a GitHub issue:

```bash
ghi --dry-run "settings screen does not preserve selected repo"
```

Use explicit source context:

```bash
ghi \
  --url "https://example.com/external-report" \
  --quote "Reporter says it crashes after enabling the optional patch" \
  --screenshot "C:\path\to\screenshot.png" \
  --explore \
  "turn this external report into a repo issue"
```

Run issue generation in the background:

```bash
ghi --async --explore "investigate recurring terminal build error"
ghi jobs
ghi job <id>
```

Agentic workflows can enqueue work without blocking the current agent task:

```bash
echo '{"summary":"Async worker loses the created issue URL","observed":"The job succeeds but later polling has no URL.","expected":"Agents can poll job JSON and continue work.","filesTouched":["packages/cli/src/background/jobs.ts"],"confidence":0.7}' \
  | ghi create --async --from-stdin --json

ghi jobs --json
ghi job <id> --json
```

When `--from-stdin` receives JSON, `ghi` treats it as structured steering context for Codex. Codex still writes the production-ready issue from repo context, templates, source evidence, and quality gates.

Score issue quality against real corpora:

```bash
bun run score:issues:good
bun run score:issues:weak
bun run score:issues:rejected
bun run score:issues:audit
bun run score:issues:check
bun tools/score_issues.ts score tools/issue-corpus/scheduleone-good.jsonl
```

Close an issue with a generated closure comment:

```bash
ghi close 42 "fixed by reconnect reconciliation patch"
ghi close 42 --duplicate-of 17 "same root cause and repro path"
ghi close 42 --dry-run "no longer applicable after mobile card redesign"
```

Check local readiness:

```bash
ghi doctor
```

## Mobile App

The Expo app provides a GitHub-style mobile workflow:

- connect a GitHub token locally
- view repositories and favorite repos
- browse open/closed issues
- open issue detail pages with rendered Markdown
- select a repo per screen instead of relying on global shared repo state
- capture a bug, feature, idea, or task
- attach screenshots or files as evidence
- save local drafts
- send captures to the desktop CLI bridge

Start the app:

```bash
bun run dev:mobile
```

The app targets Expo SDK 54 so it can run in Expo Go.

## Desktop Bridge

Mobile does not run Codex on iOS. For repo-aware generation, start a local bridge from the desktop repository that should receive the issue:

```bash
ghi mobile serve
```

The bridge prints:

- local URL
- pairing token
- pairing URL
- terminal QR code

In the mobile app, go to Settings and scan the QR code. Once paired, Capture sends the report and attachments to the desktop bridge. The bridge immediately returns a job id, saves uploaded evidence locally, and runs the actual Codex/GitHub workflow in the background.

The bridge is intentionally repo-local. If mobile selects a different repo than the desktop bridge is serving, the request is rejected instead of guessing a local checkout.

## Issue Creation Behavior

`ghi` creates issues as the currently authenticated GitHub CLI user. Bot-authored issues can be layered on later with a GitHub App, but the default workflow keeps authorship tied to the local operator.

Creation flow:

1. Read git metadata and repository templates.
2. Let Codex inspect the repo conservatively, with deeper exploration when requested.
3. Generate a structured issue payload.
4. Ensure `ai-draft` exists when permissions allow.
5. Create the issue with labels that exist in the repo.
6. Search for possible duplicates or related issues.
7. Post advisory relationship comments only when confidence is high enough.

The issue body should contain the final polished issue, not the rough prompt.

## Safety Defaults

- Conservative repo reading by default.
- Follow `.gitignore`.
- Do not read `.env` files.
- Do not expose tokens in issue bodies, logs, or docs.
- Prefer existing repo labels/templates/conventions over invented structure.
- Store visible AI provenance as labels/metadata, not body prose.

## Scripts

```bash
bun run check       # shared + CLI + mobile TypeScript
bun run test        # CLI test suite
bun run build       # build CLI
bun run smoke:node  # Node runtime smoke for the mobile bridge
bun run dev:cli     # run the CLI from source
bun run dev:mobile  # start the mobile app
```

## Agent Skill

This repository includes a Codex-compatible skill at `skills/ghi/SKILL.md`.

Agents can install or copy that skill into their Codex skills directory so they know when to use `ghi`, which flags are live mutations, how to run dry-runs, and how to close issues safely.

## Roadmap

- richer desktop job history surfaced on mobile
- hosted sync for team workflows
- optional GitHub App bot mode
- ownership/routing suggestions
- deeper issue clustering across repos and time
