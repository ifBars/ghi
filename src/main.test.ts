import { describe, expect, test } from "bun:test";
import { runCreateIssueFlow, type GithubClient } from "./main.js";
import type { GitContext, IssuePayload } from "./domain.js";

const git: GitContext = {
  root: "/repo",
  branch: "main",
  commit: "abc123",
  isDirty: false,
  remoteOwner: "ifBars",
  remoteName: "ghi",
};

const payload: IssuePayload = {
  title: "Inventory duplicates after reconnect",
  kind: "bug",
  labels: ["bug"],
  body: "## Summary\n\nInventory duplicates after reconnecting.",
  confidence: 0.8,
  missingInformation: [],
  contextSummary: ["git metadata"],
};

function fakeGithub(): { github: GithubClient; calls: string[]; comments: string[] } {
  const calls: string[] = [];
  const comments: string[] = [];
  const github: GithubClient = {
    async listLabels() {
      calls.push("list-labels");
      return [{ name: "ai-draft" }, { name: "needs-triage" }, { name: "bug" }];
    },
    async ensureAiDraftLabel() {
      calls.push("ensure-label");
    },
    async selectTriageLabel() {
      calls.push("select-triage");
      return "needs-triage";
    },
    async createIssue(options) {
      calls.push(`create:${options.labels.join(",")}`);
      expect(options.body).toContain("<!-- ghi:");
      expect(options.body).not.toContain("rough report");
      return { number: 42, url: "https://github.com/ifBars/ghi/issues/42" };
    },
    async listIssuesForSearch() {
      calls.push("search");
      return [
        {
          number: 7,
          title: "Inventory duplicates after reconnecting",
          state: "OPEN",
          url: "https://github.com/ifBars/ghi/issues/7",
        },
      ];
    },
    async comment(_issueNumber, body) {
      calls.push("comment");
      comments.push(body);
    },
  };
  return { github, calls, comments };
}

describe("runCreateIssueFlow", () => {
  test("creates ai-draft issue and posts dedupe comment", async () => {
    const { github, calls, comments } = fakeGithub();
    const output: string[] = [];

    const result = await runCreateIssueFlow("rough report", {
      cwd: "/repo",
      now: true,
    }, {
      getGitContext: async () => git,
      discoverIssueTemplates: async () => [],
      issueGenerator: { generate: async () => payload },
      githubFactory: () => github,
      write: (message) => output.push(message),
    });

    expect(result.createdIssue?.number).toBe(42);
    expect(calls).toContain("ensure-label");
    expect(calls).toContain("create:ai-draft,needs-triage,bug");
    expect(calls).toContain("comment");
    expect(comments[0]).toContain("Possibly related");
  });

  test("dry-run skips GitHub mutation", async () => {
    const output: string[] = [];

    const result = await runCreateIssueFlow("rough report", {
      cwd: "/repo",
      dryRun: true,
    }, {
      getGitContext: async () => git,
      discoverIssueTemplates: async () => [],
      issueGenerator: { generate: async () => payload },
      githubFactory: () => {
        throw new Error("should not create GitHub client");
      },
      write: (message) => output.push(message),
    });

    expect(result.createdIssue).toBeNull();
    expect(output.join("")).toContain("Inventory duplicates after reconnect");
    expect(output.join("")).toContain("<!-- ghi:");
  });

  test("terminal review can cancel creation", async () => {
    const result = await runCreateIssueFlow("rough report", {
      cwd: "/repo",
      review: true,
    }, {
      getGitContext: async () => git,
      discoverIssueTemplates: async () => [],
      issueGenerator: { generate: async () => payload },
      reviewIssue: async () => false,
      githubFactory: () => {
        throw new Error("should not create GitHub client");
      },
      write: () => undefined,
    });

    expect(result.createdIssue).toBeNull();
  });
});
