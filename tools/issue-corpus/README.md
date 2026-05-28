# Issue Quality Corpora

This folder contains small, curated JSONL corpora for calibrating `tools/score_issues.ts`.

## `scheduleone-good.jsonl`

Real public issues from:

- `ifBars/S1API`
- `ifBars/S1DedicatedServers`

These are intentionally selected as good issue-quality examples, not as a raw dump. They include strong combinations of:

- concrete observed behavior,
- expected behavior,
- reproduction steps,
- environment/version details,
- logs, screenshots, links, code snippets, or implementation context,
- focused maintainer action.

The current baseline gate is:

```bash
bun run score:issues:good
```

That command scores both `scheduleone-good.jsonl` and `production-good.jsonl`. It requires every selected issue to score at least `75/100` and the combined average to stay at least `80/100`. If the rubric changes and this corpus starts failing, either the rubric got worse or the curated set needs an intentional relabeling.

## `production-good.jsonl`

Real public issues from:

- `facebook/react`
- `microsoft/TypeScript`

These add large-project calibration so the rubric is not overfit to ScheduleOne support and modding reports. They were selected from live GitHub issue data for strong repro details, code samples, crash/error evidence, environment/version context, or narrow implementation-specific defects.

## `scheduleone-weak.jsonl`

Real public issues from `ifBars/S1API` and `ifBars/S1DedicatedServers` selected as weak examples. They include vague support requests, missing repro, thin feature asks, incomplete bug shape, or noisy maintainer context.

The weak gate is:

```bash
bun run score:issues:weak
```

That command requires every weak issue to stay at or below `65/100` and the corpus average to stay at or below `52/100`. If weak issues start scoring too high, the rubric is losing separation power.

## `maintainer-rejected.jsonl`

Real public issues from:

- `facebook/react`
- `microsoft/TypeScript`
- `pingdotgg/t3code`
- `vercel/next.js`
- `vitejs/vite`

These are closed issues where maintainers or triagers explicitly called out missing information, missing reproduction, unfilled templates, duplicate scope, support-question scope, or not-planned/out-of-scope direction. Each record includes `curation.maintainerEvidence` so the rejection reason stays auditable while the scorer still grades only the original issue text.

The rejected gate is:

```bash
bun run score:issues:rejected
```

That command requires every selected rejected issue to stay at or below `85/100` and the corpus average to stay at or below `68/100`. This is intentionally looser than `scheduleone-weak.jsonl`: some real rejected issues are reasonably detailed but still fail maintainer workflow expectations because the reproduction is not minimal, the template is incomplete, the request belongs in support, or the product direction is not planned.

## Audit

Run the corpus metadata audit before changing curated datasets:

```bash
bun run score:issues:audit
```

The audit checks duplicate `repo#number` entries, required fields, GitHub issue URLs, `curation.label` consistency, curation reasons, and maintainer-rejected evidence metadata.

## Manifest Check

`manifest.json` is the authoritative list of corpus groups and score thresholds. Run the full harness with:

```bash
bun run score:issues:check
```

That command runs the metadata audit and each manifest-declared score gate. Prefer updating the manifest when adding or recalibrating corpora instead of adding another one-off package script.

To refresh from GitHub before curating:

```bash
bun tools/score_issues.ts collect \
  --repo ifBars/S1API \
  --repo ifBars/S1DedicatedServers \
  --limit 100 \
  --state all \
  --out %TEMP%\scheduleone-issues.jsonl
```

For large public project calibration:

```bash
bun tools/score_issues.ts collect \
  --repo facebook/react \
  --repo microsoft/TypeScript \
  --limit 50 \
  --state all \
  --out %TEMP%\production-issues.jsonl
```
