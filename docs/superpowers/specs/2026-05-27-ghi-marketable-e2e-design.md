# ghi Marketable E2E Product Design

## Deadline

Marketable demo-grade product by Thursday morning, May 28, 2026 PT.

## Product Promise

`ghi` turns rough engineering signals into clean GitHub issues with minimal ceremony.

The demo must show two surfaces:

- Developer CLI: local-first, Codex-powered, creates real `ai-draft` GitHub issues through local GitHub auth.
- iOS mobile capture app: fast capture for bugs, ideas, screenshots, and voice-note text, producing structured intake drafts that can be copied/shared into the CLI/GitHub workflow.

## E2E Scope For Tomorrow

The product must be credible and demonstrable, not a fully hosted platform.

### Must Ship

- Installable CLI package workspace.
- CLI commands for immediate issue creation, dry-run generation, and terminal review.
- Reliable hidden metadata and `ai-draft` label handling.
- Advisory related/duplicate comments after issue creation.
- Expo iOS app using Expo Router that works in Expo Go.
- Mobile capture form with type selection, repo/name field, rough input field, screenshot/log notes field, and generated preview.
- Mobile local draft inbox using on-device storage.
- Share/copy/export action that produces a polished intake payload users can move into `ghi`.
- Product README with demo script and positioning.

### Explicit Constraints

- Mobile cannot directly use the user's local Codex desktop/session.
- Mobile MVP is a capture and handoff surface, not a hosted inference client.
- GitHub App bot mode remains future work.
- Hosted sync remains future work.

## Product Architecture

```text
repo
  packages/cli
    Codex SDK local generation
    GitHub CLI issue creation
  packages/shared
    issue intake types and sample formatter
  apps/mobile
    Expo iOS capture and draft inbox
```

For the deadline, `packages/shared` should stay small. It should contain stable intake types and formatting helpers that both surfaces can understand conceptually, even if the CLI still owns live Codex generation.

## Demo Flow

1. Run `ghi --dry-run "inventory dupes after reconnect"` and show the polished issue body.
2. Run `ghi --review "..."` to show the human review path.
3. Open the Expo app in Expo Go.
4. Capture a mobile report with repo, type, and notes.
5. Save it to the mobile inbox.
6. Copy/share the generated handoff text.
7. Show README section explaining how this becomes the future hosted/mobile pipeline.

## Success Criteria

- `bun install` succeeds at repo root.
- `bun run test` succeeds.
- `bun run check` succeeds.
- `bun run build` succeeds for the CLI.
- Mobile app typecheck succeeds.
- Expo app starts with `bunx expo start` from `apps/mobile`.
- README presents the product as marketable and gives a concise demo path.
