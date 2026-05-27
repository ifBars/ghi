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
- share the handoff back to the desktop workflow

For the current marketable MVP, mobile is intentionally capture/handoff-first. Direct mobile Codex generation and bot-authored GitHub issue creation require a hosted layer and remain the next product tier.

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
bun run dev -- --dry-run "inventory dupes after reconnect"
```

Review before creating:

```bash
ghi --review "inventory dupes after reconnect"
```

Force immediate creation:

```bash
ghi --now "inventory dupes after reconnect"
```

## Requirements

- Bun
- Git
- GitHub CLI authenticated for the target repo
- Codex CLI/session available to `@openai/codex-sdk`
- Expo Go for iOS mobile preview

## Current MVP behavior

`ghi` creates issues as the authenticated GitHub user. It ensures the `ai-draft` label when permissions allow, uses an existing triage label when present, and only applies inferred labels that already exist in the repo. After issue creation, it searches existing issues and posts an advisory possible duplicate/related comment when confidence is high enough.

## Workspace

```text
packages/cli      Local-first Codex + GitHub CLI workflow
packages/shared   Intake types and handoff formatting
apps/mobile       Expo iOS capture app
```
