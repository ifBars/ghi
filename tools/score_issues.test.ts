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
    expect(["usable", "excellent"]).toContain(score.grade);
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

  test("scores concise but actionable API feature requests as usable", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "ifBars/S1API",
      number: 67,
      title: "Please add OnHourPass to TimeManager",
      labels: [{ name: "enhancement" }],
      body: "Please add OnHourPass to TimeManager so we can create hourly events. I saw it in Tylers code within the Cartel files.",
      url: "https://github.com/ifBars/S1API/issues/67",
    }));

    expect(score.total).toBeGreaterThanOrEqual(65);
    expect(score.grade).toBe("usable");
  });

  test("scores concrete feature requests with API outcomes above weak", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "ifBars/S1API",
      number: 74,
      title: "[FEATURE] Wrap EmployeeManager and expose employee appearance APIs",
      labels: [{ name: "enhancement" }],
      body: `## Feature Request

### What would you like to see?
Add an S1API wrapper for the base-game \`ScheduleOne.Employees.EmployeeManager\` so modders can access employee appearance data through a supported API surface.

The immediate goal is to expose employee appearance APIs such as:
- \`GetAppearance(bool male, int index)\`
- \`GetRandomAppearance(bool male, out int index, out AvatarSettings settings)\`

### Why would this help?
Right now, modders who want employee appearance presets have to reach into base-game types directly.

A wrapper around \`EmployeeManager\` would make it easier to retrieve the preset avatar settings and mugshot/icon data used by employees without reflection or direct raw game-manager access.

### Extra Context (Optional)
Useful outcome:
- provide access to the live base-game \`EmployeeManager\` instance
- expose \`GetAppearance(bool male, int index)\`
- expose \`GetRandomAppearance(bool male, out int index, out AvatarSettings settings)\` or an S1API-friendly equivalent
- expose returned appearance data in a modder-friendly way, including avatar settings and mugshot sprite
- document how modders should use it to inspect employee appearance presets`,
      url: "https://github.com/ifBars/S1API/issues/74",
    }));

    expect(score.total).toBeGreaterThanOrEqual(75);
    expect(score.grade).toBe("usable");
  });

  test("scores compact bug reports with concrete repro scenarios as usable", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "ifBars/S1API",
      number: 46,
      title: "Phone scrollview not showing up",
      labels: [{ name: "bug" }],
      body: `## Description
The Scrollview added to the phone by S1API is not always present. This is an issue for other mods adding a phone app without S1API since they expect the scrollview to be present.

## Environment
- Schedule 1 - IL2CPP - v0.4.3f3
- MelonLoader v0.7.0
- S1API (Forked by Bars) v2.9.6

## Steps to reproduce

### Scenario 1
1. Start game
2. Load a save (scrollview is present)
3. Return to main menu
4. Load the same save
5. Scrollview is no longer present.`,
      url: "https://github.com/ifBars/S1API/issues/46",
    }));

    expect(score.total).toBeGreaterThanOrEqual(65);
    expect(score.grade).toBe("usable");
  });

  test("scores concise maintenance issues with concrete correction as usable", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "microsoft/TypeScript",
      number: 63494,
      title: "Typo in README: 'behavorial' should be 'behavioral'",
      labels: [],
      body: `The current README has a small spelling error:

> Feature additions and **behavorial** changes are currently on pause until TypeScript 7.0 is completed.

\`behavorial\` has the \`i\` and \`o\` swapped - should be \`behavioral\`.

PR fixing this: #63492`,
      url: "https://github.com/microsoft/TypeScript/issues/63494",
    }));

    expect(score.total).toBeGreaterThanOrEqual(65);
    expect(score.grade).toBe("usable");
  });

  test("scores detailed maintenance proposals as usable without bug repro sections", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "cli/cli",
      number: 13490,
      title: "SHA Pin first party actions here and across the org",
      labels: [{ name: "tech-debt" }],
      body: `## Description

Currently, we have a [dependabot cooldown period](https://github.com/cli/cli/blob/8bd56966ac5e2fe7d3162ad424dd11d877f4815e/.github/dependabot.yml) of 3 days for Go Modules and GitHub Actions.

Historically, we've tried to SHA pin third-party actions but not first party. Either we exclude first party actions from the dependabot cooldown, or we move forward on each patch release, in which case we might as well get the advantage of SHA pinning.`,
      url: "https://github.com/cli/cli/issues/13490",
    }));

    expect(score.total).toBeGreaterThanOrEqual(65);
    expect(score.grade).toBe("usable");
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

    expect(Math.max(...totals)).toBeLessThanOrEqual(65);
    expect(Math.round(average)).toBeLessThanOrEqual(52);
  });

  test("real maintainer rejected issue corpus stays below rejected scoring gates", () => {
    const scores = scoreCorpus(["maintainer-rejected.jsonl"]);
    const totals = scores.map((score) => score.total);
    const average = totals.reduce((sum, total) => sum + total, 0) / totals.length;

    expect(Math.max(...totals)).toBeLessThanOrEqual(85);
    expect(Math.round(average)).toBeLessThanOrEqual(68);
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
