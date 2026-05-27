# ghi Local-First MVP Design

## Goal

Build a local-first CLI that turns a short rough bug, feature, issue, or idea report into a polished GitHub issue using Codex SDK for repo-aware reasoning and local GitHub auth for issue creation.

## Product Shape

The MVP is a developer-native CLI:

```bash
ghi "inventory dupes after reconnect"
```

The command creates a real GitHub issue immediately by default for fast capture. The created issue is marked as a draft-like intake artifact through labels and hidden metadata, not through visible AI disclosure in the issue body.

The CLI supports configurable creation modes so other users can choose review-first behavior:

- `immediate_draft`: create the issue immediately with `ai-draft`.
- `terminal_review`: show the generated issue in the terminal before creation.
- `editor_review`: open the generated issue body in the user's editor before creation.

The first implementation focuses on `immediate_draft` and `terminal_review`; the editor mode can be added after the core flow is stable.

## Architecture

```text
ghi CLI
  -> Codex SDK local thread
  -> Codex explores repo using user's Codex auth/session
  -> ghi receives structured issue payload
  -> local GitHub auth creates issue as the user
  -> ghi ensures ai-draft label exists
  -> ghi comments with possible related/duplicate issues after creation
```

The MVP deliberately does not require a hosted service. GitHub App bot-authored issues are a later team-mode feature after the local workflow is validated.

## Issue Generation

Codex receives the rough report, current repository context, issue templates, git metadata, and safe local context. It returns a structured payload with:

- title
- issue kind
- labels
- body
- confidence
- missing information
- context summary

The original rough input must not appear in the final issue body. It can be used only as input to the transformation step.

The issue body should be repo-native and maintainable. It should include the content needed to evaluate the issue, such as summary, observed behavior, expected behavior, repro steps, relevant context, missing information, and assumptions. Hidden HTML metadata may include machine-readable `ghi` state.

## Repository Context Safety

The CLI and Codex workflow should stay inside the current repository unless explicitly extended later. Context gathering must respect `.gitignore` and exclude common secret paths:

- `.env`, `.env.*`
- private keys and certificates
- credential files
- `.npmrc`, `.pypirc`, and similar auth-bearing config
- ignored files unless explicitly supplied by the user

## GitHub Creation

The MVP uses local GitHub auth through `gh`.

Before issue creation, `ghi` ensures the `ai-draft` label exists:

- name: `ai-draft`
- color: `BFD4F2`
- description: `Created by ghi from a rough report and not yet human-triaged.`

`ghi` should also use a triage label if it already exists, preferring repo labels such as `needs-triage`, `triage`, `needs review`, or `status: triage`. It should not create several triage variants.

If label creation fails due to permissions, the issue should still be created with hidden metadata in the body.

## Duplicate and Related Issue Comments

Deduplication runs after issue creation so capture is never blocked. The CLI searches existing open and recently closed issues, asks Codex to classify likely relationships, and comments only when there is enough signal.

Comments are reserved for:

- `Possible duplicate of #123`
- `Possibly related to #456`

The CLI must not auto-close issues as duplicates in the MVP.

## Non-Goals

- Hosted inference service.
- GitHub App bot-authored issue creation.
- Mobile app.
- Jira replacement or PM workflow surface.
- Auto-closing, auto-assigning, or destructive triage behavior.

## Verification

The MVP is complete when:

- A local CLI command can generate a structured issue payload through a Codex adapter.
- The GitHub adapter can ensure `ai-draft` and create an issue through `gh`.
- The issue body excludes the rough input and includes hidden `ghi` metadata.
- The dedupe flow can search issues and post advisory comments after issue creation.
- Unit tests cover payload validation, metadata handling, label selection, GitHub command construction, and dedupe comment formatting.
