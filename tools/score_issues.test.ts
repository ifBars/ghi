import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditCorpus, normalizeIssue, scoreIssue } from "../packages/cli/src/intake/scoring.js";
import { $ } from "bun";

describe("issue scoring", () => {
  test("scores actionable bug above usable threshold", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "example/project",
      number: 1,
      title: "Crash when reconnecting after auth token refresh",
      labels: [{ name: "bug" }],
      body: `## Summary
The client crashes after reconnecting when the auth token refreshes.

## Environment
- Version: 1.2.3
- Platform: Windows

## Steps to Reproduce
1. Start the app
2. Let the token expire
3. Reconnect

## Observed Behavior
The client throws \`AuthSessionDisposedError\` and exits.

## Expected Behavior
The client refreshes the session and reconnects.

## Evidence
\`\`\`log
AuthSessionDisposedError at reconnect.ts:42
\`\`\`
`,
    }));

    expect(score.total).toBeGreaterThanOrEqual(80);
    expect(score.grade).toBe("usable");
  });

  test("scores thin support request low", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "example/project",
      number: 2,
      title: "wtf it crashes",
      labels: [{ name: "bug" }],
      body: "how do i fix it",
    }));

    expect(score.total).toBeLessThan(50);
    expect(score.warnings).toContain("bug lacks reproduction steps");
  });

  test("penalizes unfilled issue template residue", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "example/project",
      number: 3,
      title: "Please fill in each section completely",
      labels: [{ name: "bug" }],
      body: `### Version & Regression Information

- This changed between versions ______ and _______
- I was unable to test this on prior versions because _______

### Playground Link

_No response_

### Code

\`\`\`ts
// Your code here
\`\`\`

### Actual behavior

Please fill in each section completely.

### Expected behavior

_No response_
`,
    }));

    expect(score.total).toBeLessThan(55);
    expect(score.warnings).toContain("template contains unfilled placeholder text");
  });

  test("audits maintainer rejected evidence", () => {
    const findings = auditCorpus([{
      repo: "example/project",
      number: 4,
      title: "Bug: missing reproduction",
      body: "This fails but no details are provided.",
      url: "https://github.com/example/project/issues/4",
      state: "CLOSED",
      corpus: "maintainer-rejected",
      curation: {
        label: "maintainer-rejected",
        reason: "Closed with explicit maintainer evidence.",
        rejectionKind: "needs-more-info",
      },
    }]);

    expect(findings.some((finding) => finding.message.includes("maintainerEvidence"))).toBe(true);
  });

  test("real good issue corpora satisfy minimum scoring gates", () => {
    const scores = scoreCorpus(["scheduleone-good.jsonl", "production-good.jsonl"]);
    const totals = scores.map((score) => score.total);
    const average = totals.reduce((sum, total) => sum + total, 0) / totals.length;

    expect(Math.min(...totals)).toBeGreaterThanOrEqual(75);
    expect(Math.round(average)).toBeGreaterThanOrEqual(80);
  });

  test("real weak issue corpus stays below weak scoring gates", () => {
    const scores = scoreCorpus(["scheduleone-weak.jsonl"]);
    const totals = scores.map((score) => score.total);
    const average = totals.reduce((sum, total) => sum + total, 0) / totals.length;

    expect(Math.max(...totals)).toBeLessThanOrEqual(60);
    expect(Math.round(average)).toBeLessThanOrEqual(50);
  });

  test("real maintainer rejected issue corpus stays below rejected scoring gates", () => {
    const scores = scoreCorpus(["maintainer-rejected.jsonl"]);
    const totals = scores.map((score) => score.total);
    const average = totals.reduce((sum, total) => sum + total, 0) / totals.length;

    expect(Math.max(...totals)).toBeLessThanOrEqual(80);
    expect(Math.round(average)).toBeLessThanOrEqual(60);
  });

  test("manifest check runs gates and audit", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ghi-score-"));
    try {
      writeFileSync(join(directory, "good.jsonl"), `${JSON.stringify({
        repo: "example/project",
        number: 5,
        title: "Crash when reconnecting after auth token refresh",
        labels: [{ name: "bug" }],
        body: `## Summary
The client crashes after reconnecting when the auth token refreshes.

## Environment
- Version: 1.2.3
- Platform: Windows

## Steps to Reproduce
1. Start the app
2. Let the token expire
3. Reconnect

## Observed Behavior
The client throws \`AuthSessionDisposedError\` and exits.

## Expected Behavior
The client refreshes the session and reconnects.

## Evidence
\`\`\`log
AuthSessionDisposedError at reconnect.ts:42
\`\`\`
`,
        url: "https://github.com/example/project/issues/5",
        corpus: "production-good",
        curation: {
          label: "good",
          reason: "Strong issue for manifest check coverage.",
        },
      })}\n`);
      writeFileSync(join(directory, "manifest.json"), JSON.stringify({
        version: 1,
        corpora: [{
          name: "good",
          paths: ["good.jsonl"],
          gates: { minScore: 75, minAverage: 75 },
        }],
      }));

      const result = await $`bun ${join(process.cwd(), "tools/score_issues.ts")} check ${join(directory, "manifest.json")} --format json`.json();
      expect(result.ok).toBe(true);
      expect(result.corpora[0].name).toBe("good");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function scoreCorpus(files: string[]) {
  return files.flatMap(loadCorpus).map((record) => scoreIssue(normalizeIssue(record)));
}

function loadCorpus(file: string): Record<string, unknown>[] {
  const path = join(process.cwd(), "tools", "issue-corpus", file);
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
