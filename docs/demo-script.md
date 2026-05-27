# ghi Demo Script

## Positioning

`ghi` is CodeRabbit for opening and triaging issues. It captures rough engineering signals and turns them into visible, triage-ready GitHub issues.

## Demo Path

1. Start in a git repo and run:

   ```bash
   bun run dev:cli -- --dry-run "inventory dupes after reconnect"
   ```

2. Point out:

   - repo-aware title and body
   - reproduction steps
   - missing information
   - hidden `ghi` metadata
   - no rough-input dump in the issue body

3. Explain the real create path:

   ```bash
   ghi "inventory dupes after reconnect"
   ```

   This creates a real GitHub issue as the authenticated user, marks it `ai-draft`, and posts possible related/duplicate comments after creation.

4. Start mobile:

   ```bash
   bun run dev:mobile
   ```

5. In Expo Go, capture a report with:

   - type: bug
   - repo: owner/repo
   - report: inventory dupes after reconnect
   - context: Discord report, screenshot note, or repro hint

6. Save it, open Drafts, and share the handoff.

## Product Narrative

The CLI validates the hard workflow: Codex-powered local repo understanding and GitHub issue creation. The mobile app validates cross-surface capture. The next product tier connects them through hosted sync and a GitHub App bot once the core issue quality is proven.
