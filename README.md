# ghi

`ghi` is a local-first GitHub issue intake CLI powered by Codex.

The MVP turns rough bug, feature, or idea text into a polished GitHub issue:

```bash
ghi "inventory dupes after reconnect"
```

The local CLI uses the user's Codex session for repo-aware issue drafting, then creates the issue through local GitHub auth. Issues are created as normal GitHub issues with an `ai-draft` label and hidden `ghi` metadata. Follow-up comments are reserved for advisory duplicate or related-issue findings.

## MVP principles

- Local-first by default.
- Use Codex SDK as the agentic repo reasoning harness.
- Use GitHub CLI auth for issue creation in the MVP.
- Create `ai-draft` automatically when missing.
- Do not include the original rough input in the issue body.
- Keep AI provenance out of visible body copy; use labels and hidden metadata.
- Post duplicate or related issue findings as comments after creation.

## Development

```bash
bun install
bun test
bun run check
bun run build
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

## Current MVP behavior

`ghi` creates issues as the authenticated GitHub user. It ensures the `ai-draft` label when permissions allow, uses an existing triage label when present, and only applies inferred labels that already exist in the repo. After issue creation, it searches existing issues and posts an advisory possible duplicate/related comment when confidence is high enough.
