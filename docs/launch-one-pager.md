# ghi Launch One-Pager

## One-Liner

`ghi` is CodeRabbit for opening and triaging issues: rough engineering signal in, clean GitHub issue out.

## Problem

Bugs, feature ideas, Discord reports, terminal errors, screenshots, and maintainer notes get lost because creating a good GitHub issue takes too much context switching.

## Product

`ghi` gives teams a low-ceremony intake lane:

- CLI captures issues from inside the repo.
- Codex generates repo-aware issue bodies from rough text.
- GitHub issues are created visibly with `ai-draft` triage state.
- Related or duplicate issues are posted as advisory comments after creation.
- Mobile captures reports away from the desk and hands them back to the CLI workflow.

## Why Now

Coding agents can understand repo context, but teams still need a clean operational memory layer. GitHub issues are the durable artifact; `ghi` makes creating them feel as fast as sending a message.

## MVP Demo

```bash
bun run dev:cli -- doctor
bun run dev:cli -- --dry-run "inventory dupes after reconnect"
bun run dev:mobile
```

## Current Boundary

The CLI is the repo-aware creation surface. The iOS app is the capture/handoff surface. Hosted sync, GitHub App bot authorship, and direct mobile issue creation are the next tier after validating issue quality.

## Moat

The moat is not the model. The moat is repo understanding, issue-template fidelity, developer-native capture, dedupe, GitHub lifecycle integration, and cross-surface operational memory.
