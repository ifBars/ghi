# ghi Local-First MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local-first `ghi` MVP that uses Codex SDK to generate polished GitHub issue payloads and local GitHub auth to create `ai-draft` issues with post-create related/duplicate comments.

**Architecture:** The CLI is split into small adapters: config, git/repo context, Codex generation, GitHub CLI operations, issue body metadata, and dedupe comments. The MVP uses `gh` for GitHub auth and issue mutation while keeping GitHub operations behind an interface for later GitHub App mode.

**Tech Stack:** Bun, TypeScript, Commander, Zod, Execa, `@openai/codex-sdk`, GitHub CLI.

---

## File Structure

- `src/cli.ts`: CLI entrypoint and command wiring.
- `src/config.ts`: user/repo config defaults and creation-mode parsing.
- `src/domain.ts`: shared issue payload and result types.
- `src/metadata.ts`: hidden `ghi` metadata rendering and insertion.
- `src/git.ts`: current repo, branch, commit, dirty status, and remote detection.
- `src/templates.ts`: issue template discovery.
- `src/codexIssueGenerator.ts`: Codex SDK adapter that returns structured issue payloads.
- `src/githubCli.ts`: `gh` wrapper for labels, issue creation, issue search, and comments.
- `src/dedupe.ts`: related/duplicate candidate formatting and comment construction.
- `src/review.ts`: terminal review prompt.
- `src/main.ts`: orchestration for the create flow.
- `src/*.test.ts`: focused Bun tests for pure modules and command construction.

## Task 1: Domain, Metadata, and Config

**Files:**
- Create: `src/domain.ts`
- Create: `src/metadata.ts`
- Create: `src/config.ts`
- Test: `src/metadata.test.ts`
- Test: `src/config.test.ts`

- [ ] Define `IssuePayload`, `CreationMode`, `GhiConfig`, and validation schemas.
- [ ] Implement hidden metadata insertion with no visible AI disclosure.
- [ ] Implement default config with `immediate_draft`.
- [ ] Test that rough input is not required in payloads and metadata is hidden.
- [ ] Run `bun test src/metadata.test.ts src/config.test.ts`.

## Task 2: Git and Template Context

**Files:**
- Create: `src/git.ts`
- Create: `src/templates.ts`
- Test: `src/templates.test.ts`

- [ ] Implement repo root, branch, commit, dirty status, and GitHub remote parsing through `git`.
- [ ] Discover `.github/ISSUE_TEMPLATE` Markdown and YAML templates.
- [ ] Keep template reads scoped to the repository.
- [ ] Test template discovery with temporary directories.
- [ ] Run `bun test src/templates.test.ts`.

## Task 3: GitHub CLI Adapter

**Files:**
- Create: `src/githubCli.ts`
- Test: `src/githubCli.test.ts`

- [ ] Implement `gh` command wrapper with injectable runner.
- [ ] Implement label listing and `ai-draft` creation when missing.
- [ ] Implement triage label selection from existing labels.
- [ ] Implement issue creation as the authenticated user.
- [ ] Implement issue search and issue comment creation.
- [ ] Test command construction without touching the network.
- [ ] Run `bun test src/githubCli.test.ts`.

## Task 4: Codex Issue Generator

**Files:**
- Create: `src/codexIssueGenerator.ts`
- Test: `src/codexIssueGenerator.test.ts`

- [ ] Define an output schema for issue payloads.
- [ ] Build a prompt that asks Codex to transform rough input into a full issue without copying the rough input.
- [ ] Pass repo context, templates, and git context into the Codex thread.
- [ ] Parse and validate the structured payload.
- [ ] Test parsing and fallback validation with a fake generator result.
- [ ] Run `bun test src/codexIssueGenerator.test.ts`.

## Task 5: Dedupe Comments

**Files:**
- Create: `src/dedupe.ts`
- Test: `src/dedupe.test.ts`

- [ ] Build search queries from generated title and labels.
- [ ] Format advisory duplicate and related comments.
- [ ] Suppress comments when no relationship clears confidence.
- [ ] Test comment formatting.
- [ ] Run `bun test src/dedupe.test.ts`.

## Task 6: CLI Orchestration

**Files:**
- Create: `src/main.ts`
- Create: `src/review.ts`
- Create: `src/cli.ts`
- Test: `src/main.test.ts`

- [ ] Wire `ghi "<rough input>"` to repo context, templates, Codex generation, label ensure, issue create, and dedupe comment.
- [ ] Add `--now`, `--review`, and `--dry-run` flags.
- [ ] In dry-run mode, print the generated payload and skip GitHub mutation.
- [ ] Test orchestration with fake Codex and GitHub adapters.
- [ ] Run `bun test src/main.test.ts`.

## Task 7: Build and Smoke Verification

**Files:**
- Modify: `README.md`

- [ ] Run `bun install`.
- [ ] Run `bun test`.
- [ ] Run `bun run check`.
- [ ] Run `bun run build`.
- [ ] Run `bun run dev -- --dry-run "inventory dupes after reconnect"` in the repo and verify it produces a structured draft without creating a GitHub issue.
- [ ] Update README with MVP usage and setup notes.

## Self-Review

- Spec coverage: the tasks cover local-first CLI, Codex SDK generation, GitHub CLI creation, `ai-draft` label handling, hidden metadata, configurable review behavior, and post-create dedupe comments.
- Placeholder scan: no task depends on unspecified implementation details; each task names files and expected verification commands.
- Type consistency: shared types are centralized in `src/domain.ts`; adapters consume those shared types.
