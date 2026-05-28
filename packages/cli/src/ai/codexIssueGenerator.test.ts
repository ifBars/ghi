import { describe, expect, test } from "bun:test";
import { buildIssuePrompt, parseIssuePayload } from "./codexIssueGenerator.js";
import type { GitContext } from "../core/domain.js";

const git: GitContext = {
  root: "/repo",
  branch: "main",
  commit: "abc123",
  isDirty: true,
  remoteOwner: "ifBars",
  remoteName: "ghi",
};

describe("Codex issue generator", () => {
  test("parses structured issue payload", () => {
    const payload = parseIssuePayload(
      JSON.stringify({
        title: "Inventory duplicates after reconnect",
        kind: "bug",
        labels: ["bug"],
        body: "## Summary\n\nInventory duplicates after reconnecting to the server.",
        confidence: 0.8,
        missingInformation: ["Exact reconnect sequence"],
        contextSummary: ["Used git metadata"],
      }),
    );

    expect(payload.title).toBe("Inventory duplicates after reconnect");
    expect(payload.kind).toBe("bug");
  });

  test("prompt includes hard requirements and templates", () => {
    const prompt = buildIssuePrompt({
      roughInput: "inventory dupes after reconnect",
      git,
      templates: [{ name: "bug.md", path: ".github/ISSUE_TEMPLATE/bug.md", content: "Bug template" }],
      sources: [{ kind: "quote", source: "user quote", content: "Nexus report says crash on load." }],
      exploreSources: true,
      screenshots: ["C:/tmp/report.png"],
    });

    expect(prompt).toContain("Do not include the original rough report text verbatim");
    expect(prompt).toContain("bug.md");
    expect(prompt).toContain("ifBars/ghi");
    expect(prompt).toContain("Nexus report says crash on load.");
    expect(prompt).toContain("browser, Playwright, or web access tools");
    expect(prompt).toContain("C:/tmp/report.png");
  });
});
