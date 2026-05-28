import { describe, expect, test } from "bun:test";
import { formatStructuredIssueContext, parseStructuredIssueInput } from "./structured.js";

describe("structured issue intake", () => {
  test("formats agent context as steering input", () => {
    const formatted = formatStructuredIssueContext({
      kind: "bug",
      summary: "Async issue job loses the created URL",
      observed: "The worker succeeds but the caller cannot retrieve the issue URL.",
      expected: "Agents can poll the job and continue work.",
      filesTouched: ["packages/cli/src/background/jobs.ts"],
      testFailures: ["bun test src/background/jobs.test.ts"],
      confidence: 0.7,
      missingInfo: ["Exact GitHub CLI output"],
    });

    expect(formatted).toContain("Agent-discovered issue context");
    expect(formatted).toContain("structured steering context");
    expect(formatted).toContain("Async issue job loses the created URL");
    expect(formatted).toContain("- packages/cli/src/background/jobs.ts");
  });

  test("parses JSON stdin and leaves plain text alone", () => {
    expect(parseStructuredIssueInput(JSON.stringify({ summary: "Queue stalls", observed: "Job remains running" }))).toContain("Queue stalls");
    expect(parseStructuredIssueInput("plain rough report")).toBe("plain rough report");
  });
});
