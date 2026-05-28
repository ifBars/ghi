import { execa } from "execa";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ClosureStateReason,
  CreateIssueOptions,
  CreatedIssue,
  ExistingIssue,
  IssueView,
} from "./domain.js";

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type CommandRunner = (file: string, args: string[], cwd: string) => Promise<CommandResult>;

export const defaultRunner: CommandRunner = async (file, args, cwd) => {
  const result = await execa(file, args, { cwd });
  return { stdout: result.stdout, stderr: result.stderr };
};

export type GithubLabel = {
  name: string;
  color?: string;
  description?: string;
};

export type GithubCliOptions = {
  cwd: string;
  runner?: CommandRunner;
};

export class GithubCli {
  private readonly cwd: string;
  private readonly runner: CommandRunner;

  constructor(options: GithubCliOptions) {
    this.cwd = options.cwd;
    this.runner = options.runner ?? defaultRunner;
  }

  async listLabels(): Promise<GithubLabel[]> {
    const result = await this.runner(
      "gh",
      ["label", "list", "--json", "name,color,description", "--limit", "200"],
      this.cwd,
    );
    return JSON.parse(result.stdout || "[]") as GithubLabel[];
  }

  async ensureAiDraftLabel(): Promise<void> {
    const labels = await this.listLabels();
    if (labels.some((label) => label.name.toLowerCase() === "ai-draft")) {
      return;
    }

    await this.runner(
      "gh",
      [
        "label",
        "create",
        "ai-draft",
        "--color",
        "BFD4F2",
        "--description",
        "Created by ghi from a rough report and not yet human-triaged.",
      ],
      this.cwd,
    );
  }

  async selectTriageLabel(candidates: string[]): Promise<string | null> {
    const labels = await this.listLabels();
    const byName = new Map(labels.map((label) => [label.name.toLowerCase(), label.name]));

    for (const candidate of candidates) {
      const matched = byName.get(candidate.toLowerCase());
      if (matched) {
        return matched;
      }
    }

    return null;
  }

  async createIssue(options: CreateIssueOptions): Promise<CreatedIssue> {
    const tempDir = await mkdtemp(join(tmpdir(), "ghi-issue-"));
    const bodyFile = join(tempDir, "body.md");

    try {
      await writeFile(bodyFile, options.body, "utf8");
      const args = ["issue", "create", "--title", options.title, "--body-file", bodyFile];
      for (const label of options.labels) {
        args.push("--label", label);
      }

      const result = await this.runner("gh", args, this.cwd);
      const url = result.stdout.trim();
      const number = parseIssueNumber(url);
      return { url, number };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async listIssuesForSearch(query: string, limit = 10): Promise<ExistingIssue[]> {
    const result = await this.runner(
      "gh",
      [
        "issue",
        "list",
        "--state",
        "all",
        "--search",
        query,
        "--limit",
        String(limit),
        "--json",
        "number,title,state,url,body",
      ],
      this.cwd,
    );
    return JSON.parse(result.stdout || "[]") as ExistingIssue[];
  }

  async viewIssue(issue: string): Promise<IssueView> {
    const result = await this.runner(
      "gh",
      [
        "issue",
        "view",
        issue,
        "--comments",
        "--json",
        "number,title,state,url,body,labels,comments,stateReason",
      ],
      this.cwd,
    );
    return JSON.parse(result.stdout) as IssueView;
  }

  async comment(issueNumber: number, body: string): Promise<void> {
    await this.runner("gh", ["issue", "comment", String(issueNumber), "--body", body], this.cwd);
  }

  async closeIssue(options: {
    issue: string;
    comment: string;
    stateReason: ClosureStateReason;
    duplicateOf?: string;
  }): Promise<void> {
    const args = ["issue", "close", options.issue, "--comment", options.comment];
    if (options.duplicateOf) {
      args.push("--duplicate-of", options.duplicateOf);
    } else {
      args.push("--reason", options.stateReason);
    }

    await this.runner("gh", args, this.cwd);
  }
}

export function parseIssueNumber(url: string): number | null {
  const match = url.match(/\/issues\/(?<number>\d+)/);
  return match?.groups?.number ? Number(match.groups.number) : null;
}
