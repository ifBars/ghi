import { describe, expect, test } from "bun:test";
import type { GitContext, IssuePayload } from "../core/domain.js";
import { runCreateIssueFlow, type GithubClient } from "./create.js";

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
      collectSourceContexts: async () => [],
      githubFactory: () => github,
      write: (message) => output.push(message),
    });

    expect(result.createdIssue?.number).toBe(42);
    expect(calls).toContain("ensure-label");
    expect(calls).toContain("create:ai-draft,needs-triage,bug");
    expect(calls).toContain("comment");
    expect(comments[0]).toContain("Possibly related");
  });

  test("continues without ai-draft label when label creation fails", async () => {
    const output: string[] = [];
    const calls: string[] = [];
    const github: GithubClient = {
      async listLabels() {
        calls.push("list-labels");
        return [{ name: "bug" }];
      },
      async ensureAiDraftLabel() {
        calls.push("ensure-label");
        throw new Error("label permission denied");
      },
      async selectTriageLabel() {
        calls.push("select-triage");
        return null;
      },
      async createIssue(options) {
        calls.push(`create:${options.labels.join(",")}`);
        return { number: null, url: "https://github.com/ifBars/ghi/issues/44" };
      },
      async listIssuesForSearch() {
        throw new Error("should not search without issue number");
      },
      async comment() {
        throw new Error("should not comment without issue number");
      },
    };

    const result = await runCreateIssueFlow("rough report", {
      cwd: "/repo",
      now: true,
    }, {
      getGitContext: async () => git,
      discoverIssueTemplates: async () => [],
      issueGenerator: { generate: async () => ({ ...payload, labels: ["Bug", "bug", "missing"] }) },
      collectSourceContexts: async () => [],
      githubFactory: () => github,
      write: (message) => output.push(message),
    });

    expect(result.createdIssue?.number).toBeNull();
    expect(calls).toEqual(["ensure-label", "select-triage", "list-labels", "create:bug"]);
    expect(output.join("")).toContain("could not ensure ai-draft label");
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
      collectSourceContexts: async () => [],
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
      collectSourceContexts: async () => [],
      reviewIssue: async () => false,
      githubFactory: () => {
        throw new Error("should not create GitHub client");
      },
      write: () => undefined,
    });

    expect(result.createdIssue).toBeNull();
  });

  test("passes URL and quote source context to issue generator", async () => {
    let generatedInput: unknown;

    await runCreateIssueFlow("report from https://example.com/bug", {
      cwd: "/repo",
      dryRun: true,
      quotes: ["quoted external report"],
      explore: true,
    }, {
      getGitContext: async () => git,
      discoverIssueTemplates: async () => [],
      collectSourceContexts: async (input) => [
        { kind: "url", source: input.urls[0], content: "external page text" },
        { kind: "quote", source: "user quote", content: input.quotes[0] },
      ],
      issueGenerator: {
        generate: async (input) => {
          generatedInput = input;
          return payload;
        },
      },
      write: () => undefined,
    });

    expect(generatedInput).toMatchObject({
      exploreSources: true,
      sources: [
        { kind: "url", source: "https://example.com/bug" },
        { kind: "quote", content: "quoted external report" },
      ],
    });
  });

  test("deduplicates explicit and inline URLs before source collection", async () => {
    let collectedUrls: string[] = [];

    await runCreateIssueFlow("report from https://example.com/bug", {
      cwd: "/repo",
      dryRun: true,
      urls: [" https://example.com/bug ", "https://example.com/other"],
    }, {
      getGitContext: async () => git,
      discoverIssueTemplates: async () => [],
      collectSourceContexts: async (input) => {
        collectedUrls = input.urls;
        return [];
      },
      issueGenerator: { generate: async () => payload },
      write: () => undefined,
    });

    expect(collectedUrls).toEqual(["https://example.com/bug", "https://example.com/other"]);
  });

  test("passes screenshot paths to issue generator", async () => {
    let generatedInput: unknown;

    await runCreateIssueFlow("visual bug", {
      cwd: "/repo",
      dryRun: true,
      screenshots: ["C:/tmp/mobile-card.png"],
    }, {
      getGitContext: async () => git,
      discoverIssueTemplates: async () => [],
      collectSourceContexts: async () => [],
      issueGenerator: {
        generate: async (input) => {
          generatedInput = input;
          return payload;
        },
      },
      write: () => undefined,
    });

    expect(generatedInput).toMatchObject({
      screenshots: ["C:/tmp/mobile-card.png"],
    });
  });
});
