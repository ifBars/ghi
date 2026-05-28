# AGENTS.md

Guidance for agents working in this repository.

## Project

`ghi` is a local-first AI-native GitHub issue intake tool.

The product has two primary surfaces:

- `packages/cli`: developer CLI that uses Codex and GitHub CLI auth to create/close GitHub issues.
- `apps/mobile`: Expo SDK 54 mobile app for GitHub browsing, capture, drafts, and desktop CLI handoff.

The product goal is low-friction GitHub-native issue capture and triage, not project-management software.

## Package Management

Always use Bun.

```bash
bun install
bun run check
bun run test
bun run build
```

Do not use `npm`, `pnpm`, or `yarn`.

## Validation

Run focused checks while iterating, then run the relevant full checks before claiming work is complete.

Root:

```bash
bun run check
bun run test
bun run build
```

CLI:

```bash
bun run --cwd packages/cli check
bun run --cwd packages/cli test
bun run --cwd packages/cli smoke:node
```

Mobile:

```bash
bun run --cwd apps/mobile check
cd apps/mobile
bunx expo export --platform ios --output-dir .expo-export-check --clear
```

Remove `.expo-export-check` after export smoke tests.

## CLI Rules

- Keep the CLI local-first.
- Prefer TypeScript changes over generated JavaScript edits.
- Use the existing `runCreateIssueFlow`, `runCloseIssueFlow`, `GithubCli`, and job queue boundaries.
- Do not expose rough user input in the final GitHub issue body.
- Keep `ai-draft` and hidden metadata behavior intact.
- Post duplicate/related findings as follow-up comments, not in the main issue body.
- Treat `mobile serve` as a repo-local bridge. Do not guess another local checkout when the selected mobile repo differs from the served repo.
- Background jobs must stay headless on Windows.

## Mobile Rules

- The app targets Expo SDK 54 for Expo Go compatibility.
- Read Expo SDK 54 docs before changing Expo APIs or native configuration.
- Keep screen state scoped per workflow. Do not reintroduce globally shared selected repo state across Home, Issues, and Capture.
- Capture should send handoffs to the desktop CLI bridge, not OS share sheets.
- Use system light/dark mode through the shared theme.
- Avoid placeholder UI. Buttons and filter surfaces should perform real actions or be omitted.
- Keep keyboard behavior usable on iOS; do not let fixed footers lag behind or cover focused fields.

## Security And Privacy

- Never commit `.env` files, tokens, bridge pairing secrets, GitHub tokens, OpenAI keys, or generated logs.
- Follow `.gitignore` and avoid reading ignored files unless the user explicitly asks.
- Do not read environment files as repo context.
- Treat mobile attachment uploads as local handoff evidence only.
- Avoid sending private repo contents to any hosted service other than the user-selected Codex/GitHub workflows already implied by the command.

## Style

- Keep changes scoped and practical.
- Match existing TypeScript style.
- Prefer small helper functions over broad new abstractions.
- Do not add marketing pages or heavy PM concepts.
- Public docs should describe the product plainly and accurately.

## Publishing

Before pushing a public repo:

1. Run a secret scan with `rg` for common token prefixes.
2. Check `git status --short`.
3. Confirm generated output is ignored.
4. Run `bun run check`, `bun run test`, and the CLI smoke test.
5. Confirm the remote points at the intended public repository.
