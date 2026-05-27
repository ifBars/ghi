# ghi

`ghi` is AI-native GitHub issue intake.

It turns rough engineering signals into clean, triage-ready GitHub issues with almost no ceremony.

> CodeRabbit for opening and triaging issues, not reviewing PRs.

## Surfaces

- **Developer CLI**: local-first, Codex-powered issue generation from inside a git repo.
- **iOS capture app**: Expo app for away-from-desk bug, idea, screenshot, Discord, and voice-note capture.
- **Shared intake model**: stable handoff shape for future hosted sync, GitHub App bot mode, and team workflows.

## CLI

```bash
ghi "inventory dupes after reconnect"
```

The CLI uses the user's local Codex session for repo-aware issue drafting, then creates the issue through local GitHub auth. Issues are created as normal GitHub issues with an `ai-draft` label and hidden `ghi` metadata. Follow-up comments are reserved for advisory duplicate or related-issue findings.

## iOS App

The Expo app is a fast mobile capture surface:

- select bug, feature, idea, or task
- capture repository, rough report, and extra context
- preview the structured issue handoff
- save to a local draft inbox
- copy or share the handoff back to the desktop workflow

For the current marketable MVP, mobile is intentionally capture/handoff-first. It does not run Codex on iOS. Direct mobile Codex generation and bot-authored GitHub issue creation require a hosted layer or remote agent bridge and remain the next product tier.

## Principles

- Local-first by default.
- Use Codex SDK as the agentic repo reasoning harness.
- Use GitHub CLI auth for issue creation in the MVP.
- Create `ai-draft` automatically when missing.
- Do not include the original rough input in the issue body.
- Keep AI provenance out of visible body copy; use labels and hidden metadata.
- Post duplicate or related issue findings as comments after creation.

## Demo

```bash
bun install
bun run test
bun run check
bun run build

# Local preflight
bun run dev:cli -- doctor

# CLI dry run through Codex
bun run dev:cli -- --dry-run "inventory dupes after reconnect"

# Mobile app for Expo Go
bun run dev:mobile
```

## Usage

Run from inside a GitHub-backed git repository:

```bash
ghi "inventory dupes after reconnect"
```

For local development without creating an issue:

```bash
bun run dev:cli -- --dry-run "inventory dupes after reconnect"
```

Review before creating:

```bash
ghi --review "inventory dupes after reconnect"
```

Force immediate creation:

```bash
ghi --now "inventory dupes after reconnect"
```

Create from an external report:

```bash
ghi --url "https://www.nexusmods.com/example/mods/123?tab=bugs" \
  --quote "Reporter says the game crashes after enabling the optional patch" \
  --screenshot "C:\\path\\to\\captured-report.png" \
  --explore \
  "diagnose and file the Nexus Mods bug report"
```

Use async mode when exploration may take a while:

```bash
ghi --async --url "https://www.nexusmods.com/example/mods/123?tab=bugs" \
  --quote "Crash after install, happens before main menu" \
  --explore \
  "turn this external report into a repo issue"

ghi jobs
ghi job <id>
```

Preflight local requirements:

```bash
ghi doctor
```

Local install while developing:

```bash
bun run build
cd packages/cli
bun link
```

## Requirements

- Bun
- Git
- GitHub CLI authenticated for the target repo
- Codex CLI/session available to `@openai/codex-sdk`
- Expo Go for iOS mobile preview

## Current MVP behavior

`ghi` creates issues as the authenticated GitHub user. It ensures the `ai-draft` label when permissions allow, uses an existing triage label when present, and only applies inferred labels that already exist in the repo. After issue creation, it searches existing issues and posts an advisory possible duplicate/related comment when confidence is high enough.

Mobile drafts are not repo-aware until they are handed off to the desktop CLI. This is deliberate: the repo-aware Codex step runs where the repository, GitHub CLI auth, and Codex SDK session exist.

External report intake accepts `--url`, `--quote`, and `--explore`. The CLI performs a best-effort URL text prefetch and passes the source bundle into Codex. With `--explore`, Codex is instructed to use available browser, Playwright, web, or future tool adapters when the runtime supports them, especially for visual reports and third-party issue pages.

Visual evidence can be attached with `--screenshot <path>`. This is designed for agent workflows that first capture an image with browser, Playwright, Playwright interactive, OpenClaw-style site agents, or a user-provided screenshot, then hand that artifact to `ghi`.

## Workspace

```text
packages/cli      Local-first Codex + GitHub CLI workflow
packages/shared   Intake types and handoff formatting
apps/mobile       Expo iOS capture app
```
