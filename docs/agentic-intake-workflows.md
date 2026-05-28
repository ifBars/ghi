# Agentic Intake Workflows

## Goal

`ghi` should handle more than one-line local notes. It should turn messy external signals into issue-quality GitHub artifacts:

- Nexus Mods bug reports
- mod pages plus quoted comments
- Discord/community reports
- screenshots or visual UI reports
- terminal logs
- external documentation or compatibility notes

## Current CLI Surface

```bash
ghi "rough local note"
ghi --url "https://example.com/report" "turn this report into an issue"
ghi --quote "Reporter says it crashes after install" "file this as a bug"
ghi --url "https://example.com/report" --quote "quoted report text" --explore "diagnose this"
ghi --screenshot "C:\path\to\screenshot.png" "file this visual issue"
ghi --async --url "https://example.com/report" --explore "file this external report"
```

## What `--url` Does

The CLI performs a best-effort text prefetch:

- URL
- HTTP status
- page title
- stripped page text
- fetch error if inaccessible

This is intentionally not treated as complete proof. Authenticated or script-heavy sites may return incomplete content. In that case, `ghi` passes the URL and failure details to Codex so the final issue can state what was and was not verified.

Use `--no-fetch` when the URL should only be handed to Codex/tooling:

```bash
ghi --no-fetch --url "https://www.nexusmods.com/..." --explore "file this report"
```

## What `--quote` Does

`--quote` captures pasted report text as source evidence without requiring the final issue to dump it verbatim.

```bash
ghi --quote "Crash on launch after enabling optional patch. Logs mention missing asset bundle." \
  "create the issue"
```

The final issue should summarize the reporter claim, observed symptoms, likely affected area, missing information, and reproduction path.

## What `--explore` Means

`--explore` tells Codex to spend extra effort on source examination. The prompt explicitly asks Codex to use available tools when the runtime supports them:

- Browser skill for in-app browser inspection
- Playwright skill for terminal browser automation and screenshots
- Playwright interactive skill for persistent UI/debug sessions
- Web/network tools for source verification
- external site adapters for structured bug trackers, forums, and docs

For visual or UI reports, the expected behavior is:

- inspect the page or app state when possible
- capture screenshot context when applicable
- pass captured screenshots to `ghi --screenshot <path>`
- describe what was verified versus inferred
- include screenshot/source references in the issue body when useful

## Screenshot Evidence

`ghi` accepts local image paths:

```bash
ghi --screenshot "C:\captures\nexus-bug.png" \
  --quote "Reporter says the mod page shows crash reports for optional patch users" \
  "document this visual bug report"
```

This keeps screenshot capture decoupled from issue creation. Browser-oriented agents can use the best available tool for capture:

- Codex Browser skill for in-app browser screenshots
- Playwright CLI for deterministic browser screenshots
- Playwright interactive for persistent local UI debugging
- external site adapters for bug trackers, forums, and docs

Then `ghi` passes those images into Codex as visual source evidence.

## Nexus Mods Pattern

Common command:

```bash
ghi --async \
  --url "https://www.nexusmods.com/<game>/mods/<id>?tab=bugs" \
  --screenshot "C:\captures\nexus-bug-report.png" \
  --quote "User report: crash after installing optional compatibility patch. Happens before main menu." \
  --explore \
  "diagnose this Nexus Mods bug report and file a maintainer-ready issue"
```

Expected issue sections:

- Summary
- Source Context
- Reporter Claim
- Observed Behavior
- Expected Behavior
- Reproduction Steps
- Affected Version or Mod Configuration
- Likely Subsystem
- Missing Information
- Maintainer Action Items

## Tool Adapter Direction

`ghi` keeps source exploration adapter-oriented:

- `browser`: visible/hidden browser inspection and screenshots
- `playwright`: deterministic page snapshots and screenshot artifacts
- `openclaw`: external site workflows for mod pages, forums, bug trackers, and docs
- `logs`: structured terminal/log parsing
- `screenshots`: image attachment summarization

The core design should stay adapter-oriented: external tools produce source contexts and artifacts; Codex turns those into a clean issue payload; GitHub creation remains a separate adapter.
