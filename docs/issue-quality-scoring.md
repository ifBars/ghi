# Issue Quality Scoring

`ghi` needs a way to tell whether generated issues are actually maintainer-ready. The scoring harness starts with heuristic scoring against real issues, then can grow into a gold-set and LLM-judge workflow later.

## Commands

Collect real GitHub issues into JSONL:

```bash
bun tools/score_issues.ts collect \
  --repo ifBars/S1API \
  --repo ifBars/S1DedicatedServers \
  --limit 100 \
  --state all \
  --out %TEMP%\scheduleone-issues.jsonl
```

Score a corpus:

```bash
bun tools/score_issues.ts score tools/issue-corpus/scheduleone-good.jsonl
bun tools/score_issues.ts score tools/issue-corpus/scheduleone-good.jsonl --format json
```

Run the curated-good baseline gate:

```bash
bun run score:issues:good
```

Run the weak-corpus separation gate:

```bash
bun run score:issues:weak
```

Run the maintainer-rejected calibration gate:

```bash
bun run score:issues:rejected
```

Audit corpus metadata:

```bash
bun run score:issues:audit
```

Run the full manifest-driven scoring check:

```bash
bun run score:issues:check
```

## Rubric

The current rubric is `100` points:

- `actionability` (`20`): title/body give a maintainer enough to start work.
- `expected_observed_repro` (`15`): bugs separate observed, expected, and repro details.
- `specificity` (`15`): concrete files, APIs, versions, commands, logs, or issue references.
- `evidence` (`15`): links, logs, screenshots, code blocks, stack traces, or source context.
- `scope_control` (`10`): one focused issue rather than a grab bag.
- `template_fit` (`10`): maps cleanly to common issue-template sections.
- `uncertainty_hygiene` (`5`): unknowns and assumptions are marked instead of invented.
- `maintainer_tone` (`5`): clear, neutral, and production-ready.
- `hygiene` (`5`): avoids AI disclosure, rough-input mechanics, local paths, and secrets.

Unfilled issue-template residue is penalized separately. Copied template instructions, `_No response_`, placeholder underscores, or `// Your code here` make an issue look structured while still being low-quality for maintainers.

## Corpus Strategy

Do not assume every production issue is good. Use a mix of:

- curated good examples from `S1API`, `S1DedicatedServers`, and other user projects,
- intentionally weak real issues for negative calibration,
- broad high-quality public project issues for style diversity,
- `ghi --dry-run` outputs for regression checks.

The first checked-in corpus is `tools/issue-corpus/scheduleone-good.jsonl`. It is deliberately curated from public ScheduleOne project issues and gated with `--min-score 75 --min-average 80`.

The checked-in corpora now cover:

- `scheduleone-good.jsonl`: strong public issues from `ifBars/S1API` and `ifBars/S1DedicatedServers`.
- `production-good.jsonl`: strong public issues from `facebook/react` and `microsoft/TypeScript`.
- `scheduleone-weak.jsonl`: thin/noisy public ScheduleOne issues that should score low.
- `maintainer-rejected.jsonl`: closed public issues from React, TypeScript, t3code, Next.js, and Vite with explicit maintainer or triager evidence for missing information, missing reproduction, duplicate scope, support-only scope, or not-planned direction.

The positive gate keeps all good examples at or above `75/100` with a combined average of at least `80/100`. The weak gate keeps every weak example at or below `60/100` with an average at or below `50/100`.
The rejected gate keeps every selected rejected issue at or below `80/100` with an average at or below `60/100`. Its threshold is wider because rejected issues are not all equally bad: some are detailed but fail due to wrong venue, duplicate scope, or a non-planned product direction.

The audit gate checks corpus mechanics rather than issue quality. It fails on duplicate `repo#number` entries, missing required fields, URLs that do not match the issue identifier, mismatched curation labels, missing curation reasons, or `maintainer-rejected` records without an explicit `rejectionKind` and `maintainerEvidence`.

`tools/issue-corpus/manifest.json` is the authoritative grading manifest. Its `corpora` entries declare which JSONL files belong to each calibration set and which score gates apply. `bun run score:issues:check` runs the manifest as a single regression gate: corpus audit first, then each score threshold.

The implementation lives in TypeScript: reusable scoring logic is in `packages/cli/src/intake/scoring.ts`, and the corpus CLI is `tools/score_issues.ts`. Generated `ghi` drafts use the same scorer as the corpus harness; drafts below the usable threshold are sent back through Codex with dimension-specific scoring feedback before creation continues.

## Next Steps

- Add generated `ghi` dry-run fixtures and compare them to the curated-good baseline.
- Add manual gold labels (`excellent`, `usable`, `weak`, `bad`) once there are enough examples to tune weights.
- Expand production corpora beyond React and TypeScript into more ecosystems.
