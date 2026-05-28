import { describe, expect, test } from "bun:test";
import { buildClosurePrompt, parseClosurePayload } from "./codexClosureGenerator.js";
import type { GitContext, IssueView } from "../core/domain.js";

const git: GitContext = {
  root: "/repo",
  branch: "main",
  commit: "abc123",
  isDirty: false,
  remoteOwner: "ifBars",
  remoteName: "ghi",
};

const issue: IssueView = {
  number: 42,
  title: "Mobile project cards overflow",
  state: "OPEN",
  url: "https://github.com/ifBars/site/issues/42",
  body: "Cards overflow on mobile.",
};

describe("parseClosurePayload", () => {
  test("parses structured closure payload", () => {
    const parsed = parseClosurePayload(JSON.stringify({
      comment: "Closing this because the mobile card layout was addressed by the responsive detail view update.",
      stateReason: "completed",
      confidence: 0.9,
      summary: ["Responsive layout updated"],
      followUps: [],
    }));

    expect(parsed.stateReason).toBe("completed");
    expect(parsed.comment).toContain("Closing this");
  });
});

describe("buildClosurePrompt", () => {
  test("includes issue, notes, and duplicate context", () => {
    const prompt = buildClosurePrompt({
      issue,
      reasonNotes: ["covered by the new responsive detail view"],
      duplicateOf: { ...issue, number: 7, title: "Project card detail view is cramped" },
      requestedStateReason: "duplicate",
      git,
    });

    const parsed = JSON.parse(prompt);
    expect(parsed.task).toContain("closure comment");
    expect(parsed.issue.number).toBe(42);
    expect(parsed.duplicateOf.number).toBe(7);
    expect(parsed.reasonNotes).toEqual(["covered by the new responsive detail view"]);
    expect(parsed.requestedStateReason).toBe("duplicate");
  });
});
