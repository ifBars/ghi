import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { CodexClosureGenerator, type ClosureGenerator } from "../ai/codexClosureGenerator.js";
import { closureStateReasonSchema, type ClosurePayload, type ClosureStateReason, type GitContext, type IssueView } from "../core/domain.js";
import { getGitContext } from "../integrations/git.js";
import { GithubCli } from "../integrations/githubCli.js";

export type CloseGithubClient = {
  viewIssue(issue: string): Promise<IssueView>;
  closeIssue(options: {
    issue: string;
    comment: string;
    stateReason: ClosureStateReason;
    duplicateOf?: string;
  }): Promise<void>;
};

export type CloseIssueOptions = {
  cwd: string;
  issue: string;
  reasonNotes: string[];
  duplicateOf?: string;
  stateReason?: string;
  dryRun?: boolean;
  review?: boolean;
};

export type CloseIssueDeps = {
  getGitContext?: (cwd: string) => Promise<GitContext>;
  githubFactory?: (repoRoot: string) => CloseGithubClient;
  closureGenerator?: ClosureGenerator;
  reviewClosure?: (payload: ClosurePayload) => Promise<boolean>;
  write?: (message: string) => void;
};

export async function runCloseIssueFlow(
  options: CloseIssueOptions,
  deps: CloseIssueDeps = {},
): Promise<{ payload: ClosurePayload; closed: boolean }> {
  const write = deps.write ?? ((message) => process.stdout.write(message));
  const gitContext = await (deps.getGitContext ?? getGitContext)(options.cwd);
  const github = deps.githubFactory?.(gitContext.root) ?? new GithubCli({ cwd: gitContext.root });
  const issue = await github.viewIssue(options.issue);
  const duplicateOf = options.duplicateOf ? await github.viewIssue(options.duplicateOf) : null;
  const requestedStateReason = normalizeStateReason(options.stateReason, Boolean(duplicateOf));
  const closureGenerator = deps.closureGenerator ?? new CodexClosureGenerator();
  const payload = await closureGenerator.generate({
    issue,
    duplicateOf,
    requestedStateReason,
    reasonNotes: normalizeReasonNotes(options.reasonNotes),
    git: gitContext,
  });
  const stateReason = requestedStateReason ?? payload.stateReason;

  if (options.dryRun) {
    write(`${JSON.stringify({ ...payload, stateReason }, null, 2)}\n`);
    return { payload: { ...payload, stateReason }, closed: false };
  }

  if (options.review) {
    const approved = await (deps.reviewClosure ?? reviewClosureInTerminal)({ ...payload, stateReason });
    if (!approved) {
      write("Issue closure cancelled.\n");
      return { payload: { ...payload, stateReason }, closed: false };
    }
  }

  await github.closeIssue({
    issue: options.issue,
    comment: payload.comment,
    stateReason,
    duplicateOf: options.duplicateOf,
  });
  write(`Closed issue #${issue.number}: ${issue.url}\n`);
  return { payload: { ...payload, stateReason }, closed: true };
}

export function normalizeStateReason(
  value: string | undefined,
  hasDuplicateOf: boolean,
): ClosureStateReason | null {
  if (!value) {
    return hasDuplicateOf ? "duplicate" : null;
  }

  const normalized = value.trim().toLowerCase().replace(/-/g, " ");
  const parsed = closureStateReasonSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error("state reason must be one of: completed, not planned, duplicate");
  }
  return parsed.data;
}

function normalizeReasonNotes(notes: string[]): string[] {
  return notes.map((note) => note.trim()).filter(Boolean);
}

async function reviewClosureInTerminal(payload: ClosurePayload): Promise<boolean> {
  output.write(`\n${payload.comment}\n\n`);
  output.write(`Close reason: ${payload.stateReason}\n`);
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question("Close this GitHub issue? [y/N] ");
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}
