import { describe, expect, test } from "bun:test";
import { GithubCli, parseIssueNumber, type CommandRunner } from "./githubCli.js";

function fakeRunner(outputs: string[] = []): { runner: CommandRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: CommandRunner = async (file, args) => {
    calls.push([file, ...args]);
    return { stdout: outputs.shift() ?? "[]", stderr: "" };
  };
  return { runner, calls };
}

describe("GithubCli", () => {
  test("creates ai-draft label when missing", async () => {
    const { runner, calls } = fakeRunner(["[]", ""]);
    const github = new GithubCli({ cwd: "/repo", runner });

    await github.ensureAiDraftLabel();

    expect(calls[1]).toEqual([
      "gh",
      "label",
      "create",
      "ai-draft",
      "--color",
      "BFD4F2",
      "--description",
      "Created by ghi from a rough report and not yet human-triaged.",
    ]);
  });

  test("does not create ai-draft label when present", async () => {
    const { runner, calls } = fakeRunner(['[{"name":"ai-draft"}]']);
    const github = new GithubCli({ cwd: "/repo", runner });

    await github.ensureAiDraftLabel();

    expect(calls).toHaveLength(1);
  });

  test("selects existing triage label by candidate order", async () => {
    const { runner } = fakeRunner(['[{"name":"bug"},{"name":"status: triage"}]']);
    const github = new GithubCli({ cwd: "/repo", runner });

    await expect(github.selectTriageLabel(["needs-triage", "status: triage"])).resolves.toBe(
      "status: triage",
    );
  });

  test("creates issue with title body and labels", async () => {
    const { runner, calls } = fakeRunner(["https://github.com/o/r/issues/42"]);
    const github = new GithubCli({ cwd: "/repo", runner });

    const created = await github.createIssue({
      title: "Inventory duplicates after reconnect",
      body: "Issue body",
      labels: ["ai-draft", "bug"],
    });

    expect(created.number).toBe(42);
    expect(calls[0]).toEqual([
      "gh",
      "issue",
      "create",
      "--title",
      "Inventory duplicates after reconnect",
      "--body",
      "Issue body",
      "--label",
      "ai-draft",
      "--label",
      "bug",
    ]);
  });

  test("comments on issue", async () => {
    const { runner, calls } = fakeRunner([""]);
    const github = new GithubCli({ cwd: "/repo", runner });

    await github.comment(42, "Possible duplicate of #1");

    expect(calls[0]).toEqual(["gh", "issue", "comment", "42", "--body", "Possible duplicate of #1"]);
  });
});

describe("parseIssueNumber", () => {
  test("parses issue URLs", () => {
    expect(parseIssueNumber("https://github.com/o/r/issues/123")).toBe(123);
  });

  test("returns null for non-issue output", () => {
    expect(parseIssueNumber("created")).toBeNull();
  });
});
