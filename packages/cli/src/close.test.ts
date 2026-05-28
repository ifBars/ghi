import { describe, expect, test } from "bun:test";
import { normalizeStateReason, runCloseIssueFlow, type CloseGithubClient } from "./close.js";
import type { ClosurePayload, GitContext, IssueView } from "./domain.js";

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
  title: "Inventory duplicates after reconnect",
  state: "OPEN",
  url: "https://github.com/ifBars/ghi/issues/42",
  body: "Inventory duplicates after reconnecting.",
  labels: [{ name: "bug" }],
  comments: [],
};

const duplicate: IssueView = {
  number: 7,
  title: "Inventory can duplicate after reconnecting",
  state: "OPEN",
  url: "https://github.com/ifBars/ghi/issues/7",
  body: "Canonical issue.",
};

const payload: ClosurePayload = {
  comment: "Closing this because the reconnect duplication case is now covered by the shipped inventory reconciliation fix.",
  stateReason: "completed",
  confidence: 0.8,
  summary: ["Fix shipped"],
  followUps: [],
};

function fakeGithub(): { github: CloseGithubClient; calls: string[] } {
  const calls: string[] = [];
  const github: CloseGithubClient = {
    async viewIssue(value) {
      calls.push(`view:${value}`);
      return value === "7" ? duplicate : issue;
    },
    async closeIssue(options) {
      calls.push(`close:${options.issue}:${options.stateReason}:${options.duplicateOf ?? ""}`);
    },
  };
  return { github, calls };
}

describe("normalizeStateReason", () => {
  test("defaults duplicate-of closures to duplicate", () => {
    expect(normalizeStateReason(undefined, true)).toBe("duplicate");
  });

  test("normalizes not-planned spelling", () => {
    expect(normalizeStateReason("not-planned", false)).toBe("not planned");
  });

  test("rejects unsupported reasons", () => {
    expect(() => normalizeStateReason("wontfix", false)).toThrow("state reason");
  });
});

describe("runCloseIssueFlow", () => {
  test("dry-run generates closure without closing", async () => {
    const { github, calls } = fakeGithub();
    const output: string[] = [];

    const result = await runCloseIssueFlow({
      cwd: "/repo",
      issue: "42",
      reasonNotes: ["fixed by reconnect reconciliation"],
      dryRun: true,
    }, {
      getGitContext: async () => git,
      githubFactory: () => github,
      closureGenerator: {
        generate: async (input) => {
          expect(input.reasonNotes).toEqual(["fixed by reconnect reconciliation"]);
          return payload;
        },
      },
      write: (message) => output.push(message),
    });

    expect(result.closed).toBe(false);
    expect(calls).toEqual(["view:42"]);
    expect(output.join("")).toContain("reconnect duplication case");
  });

  test("review can cancel closure", async () => {
    const { github, calls } = fakeGithub();

    const result = await runCloseIssueFlow({
      cwd: "/repo",
      issue: "42",
      reasonNotes: ["not needed"],
      review: true,
    }, {
      getGitContext: async () => git,
      githubFactory: () => github,
      closureGenerator: { generate: async () => payload },
      reviewClosure: async () => false,
      write: () => undefined,
    });

    expect(result.closed).toBe(false);
    expect(calls).toEqual(["view:42"]);
  });

  test("closes duplicate with duplicate context", async () => {
    const { github, calls } = fakeGithub();

    const result = await runCloseIssueFlow({
      cwd: "/repo",
      issue: "42",
      duplicateOf: "7",
      reasonNotes: ["same reconnect bug"],
    }, {
      getGitContext: async () => git,
      githubFactory: () => github,
      closureGenerator: {
        generate: async (input) => {
          expect(input.duplicateOf?.number).toBe(7);
          expect(input.requestedStateReason).toBe("duplicate");
          return {
            ...payload,
            comment: "Closing this as a duplicate of #7 because both reports cover reconnect inventory duplication.",
            stateReason: "duplicate",
          };
        },
      },
      write: () => undefined,
    });

    expect(result.closed).toBe(true);
    expect(calls).toEqual(["view:42", "view:7", "close:42:duplicate:7"]);
  });
});
