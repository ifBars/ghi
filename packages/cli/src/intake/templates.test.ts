import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverIssueTemplates, summarizeIssueTemplate } from "./templates.js";
import { parseGitHubRemote } from "../integrations/git.js";

describe("templates", () => {
  test("discovers markdown and yaml issue templates", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghi-templates-"));
    const templateRoot = join(root, ".github", "ISSUE_TEMPLATE");
    await mkdir(templateRoot, { recursive: true });
    await writeFile(join(templateRoot, "bug.md"), "Bug template", "utf8");
    await writeFile(join(templateRoot, "feature.yml"), "name: Feature", "utf8");
    await writeFile(join(templateRoot, "notes.txt"), "ignore me", "utf8");

    const templates = await discoverIssueTemplates(root);

    expect(templates.map((template) => template.name)).toEqual(["bug.md", "feature.yml"]);
    expect(templates[0].path).toContain(".github");
  });

  test("returns empty list when no templates exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghi-no-templates-"));
    expect(await discoverIssueTemplates(root)).toEqual([]);
  });

  test("summarizes template metadata and prompts for Codex selection", () => {
    const summary = summarizeIssueTemplate({
      name: "bug_report.yml",
      path: ".github/ISSUE_TEMPLATE/bug_report.yml",
      content: [
        "name: Bug report",
        "description: Report a production defect",
        "labels: bug, needs-triage",
        "body:",
        "  - type: textarea",
        "    attributes:",
        "      label: Reproduction steps",
        "      description: What did you do before it failed?",
      ].join("\n"),
    });

    expect(summary.title).toBe("Bug report");
    expect(summary.description).toBe("Report a production defect");
    expect(summary.labels).toEqual(["bug", "needs-triage"]);
    expect(summary.prompts).toContain("Reproduction steps");
    expect(summary.prompts).toContain("What did you do before it failed?");
  });
});

describe("git remote parsing", () => {
  test("parses GitHub ssh remote", () => {
    expect(parseGitHubRemote("git@github.com:ifBars/ghi.git")).toEqual({
      owner: "ifBars",
      name: "ghi",
    });
  });

  test("parses GitHub https remote", () => {
    expect(parseGitHubRemote("https://github.com/ifBars/ghi.git")).toEqual({
      owner: "ifBars",
      name: "ghi",
    });
  });
});
