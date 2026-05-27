import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverIssueTemplates } from "./templates.js";
import { parseGitHubRemote } from "./git.js";

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
