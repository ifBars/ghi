# ghi Demo Script

## Positioning

`ghi` is CodeRabbit for opening and triaging issues. It captures rough engineering signals and turns them into visible, triage-ready GitHub issues.

## Demo Path

1. Start in a git repo and run:

   ```bash
   bun run dev:cli -- doctor
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

6. Save it, open Drafts, and copy or share the handoff.

7. Show external report intake:

   ```bash
   ghi --dry-run --no-fetch \
     --url "https://www.nexusmods.com/example/mods/123?tab=bugs" \
     --quote "Reporter says the game crashes after enabling the optional patch" \
     --explore \
     "diagnose and file this Nexus Mods report"
   ```

   Point out that mobile and external sites are treated as source context, while repo-aware issue creation still happens from the desktop CLI.

8. Explain visual workflows:

   ```bash
   ghi --dry-run --screenshot "C:\captures\opened-project-card-mobile.png" \
     "make mobile UX better once project cards are opened"
   ```

   Browser, Playwright, or future site-agent tools capture the screenshot; `ghi` turns the screenshot plus report into a maintainer-ready issue.

## Product Narrative

The CLI validates the hard workflow: Codex-powered local repo understanding and GitHub issue creation. The mobile app validates cross-surface capture without pretending iOS can run the local Codex repo agent. The next product tier connects them through hosted sync and a GitHub App bot once the core issue quality is proven.
