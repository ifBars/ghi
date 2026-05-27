import { loadConfig, type ConfigOverrides } from "./config.js";
import { CodexIssueGenerator, type IssueGenerator } from "./codexIssueGenerator.js";
import { buildDedupeSearchQuery, formatRelationshipComment, rankSimpleRelationships } from "./dedupe.js";
import type { CreatedIssue, GitContext, IssuePayload, IssueTemplate } from "./domain.js";
import { getGitContext } from "./git.js";
import { GithubCli } from "./githubCli.js";
import { appendHiddenMetadata, buildMetadata } from "./metadata.js";
import { reviewIssueInTerminal } from "./review.js";
import { discoverIssueTemplates } from "./templates.js";

export type GithubClient = {
  listLabels(): Promise<{ name: string }[]>;
  ensureAiDraftLabel(): Promise<void>;
  selectTriageLabel(candidates: string[]): Promise<string | null>;
  createIssue(options: { title: string; body: string; labels: string[] }): Promise<CreatedIssue>;
  listIssuesForSearch(query: string, limit?: number): Promise<unknown[]>;
  comment(issueNumber: number, body: string): Promise<void>;
};

export type CreateFlowOptions = ConfigOverrides & {
  cwd: string;
  dryRun?: boolean;
  review?: boolean;
  now?: boolean;
};

export type CreateFlowDeps = {
  getGitContext?: (cwd: string) => Promise<GitContext>;
  discoverIssueTemplates?: (repoRoot: string) => Promise<IssueTemplate[]>;
  issueGenerator?: IssueGenerator;
  githubFactory?: (repoRoot: string) => GithubClient;
  reviewIssue?: (payload: IssuePayload) => Promise<boolean>;
  write?: (message: string) => void;
};

export async function runCreateIssueFlow(
  roughInput: string,
  options: CreateFlowOptions,
  deps: CreateFlowDeps = {},
): Promise<{ payload: IssuePayload; createdIssue: CreatedIssue | null }> {
  const write = deps.write ?? ((message) => process.stdout.write(message));
  const config = loadConfig({
    creationMode: options.review
      ? "terminal_review"
      : options.now
        ? "immediate_draft"
        : options.creationMode,
  });

  const gitContext = await (deps.getGitContext ?? getGitContext)(options.cwd);
  const templates = await (deps.discoverIssueTemplates ?? discoverIssueTemplates)(gitContext.root);
  const issueGenerator = deps.issueGenerator ?? new CodexIssueGenerator();
  const payload = await issueGenerator.generate({ roughInput, git: gitContext, templates });

  if (config.creationMode === "terminal_review") {
    const approved = await (deps.reviewIssue ?? reviewIssueInTerminal)(payload);
    if (!approved) {
      write("Issue creation cancelled.\n");
      return { payload, createdIssue: null };
    }
  }

  const body = appendHiddenMetadata(payload.body, buildMetadata(payload, gitContext, config.creationMode));

  if (options.dryRun) {
    write(`${JSON.stringify({ ...payload, body }, null, 2)}\n`);
    return { payload: { ...payload, body }, createdIssue: null };
  }

  const github = deps.githubFactory?.(gitContext.root) ?? new GithubCli({ cwd: gitContext.root });
  let canUseAiDraftLabel = true;
  try {
    await github.ensureAiDraftLabel();
  } catch (error) {
    canUseAiDraftLabel = false;
    write(`Warning: could not ensure ai-draft label; creating issue without it. ${formatError(error)}\n`);
  }

  const triageLabel = await github.selectTriageLabel(config.triageLabelCandidates).catch(() => null);
  const existingLabels = await github.listLabels().catch(() => []);
  const existingLabelNames = new Map(existingLabels.map((label) => [label.name.toLowerCase(), label.name]));
  const inferredExistingLabels = payload.labels
    .filter((label) => label !== config.aiDraftLabel)
    .map((label) => existingLabelNames.get(label.toLowerCase()))
    .filter((label): label is string => Boolean(label));

  const labels = normalizeLabels([
    ...(canUseAiDraftLabel ? [config.aiDraftLabel] : []),
    ...(triageLabel ? [triageLabel] : []),
    ...inferredExistingLabels,
  ]);

  const createdIssue = await github.createIssue({
    title: payload.title,
    body,
    labels,
  });

  write(`Created issue: ${createdIssue.url}\n`);

  if (createdIssue.number !== null) {
    await postDedupeComment(github, createdIssue.number, payload, write);
  }

  return { payload: { ...payload, body }, createdIssue };
}

export function extractCreatedIssueUrl(output: string): string | null {
  const match = output.match(/Created issue:\s+(?<url>https?:\/\/\S+)/);
  return match?.groups?.url ?? null;
}

async function postDedupeComment(
  github: GithubClient,
  createdIssueNumber: number,
  payload: IssuePayload,
  write: (message: string) => void,
): Promise<void> {
  try {
    const query = buildDedupeSearchQuery(payload);
    const candidates = await github.listIssuesForSearch(query, 10);
    const relationships = rankSimpleRelationships(createdIssueNumber, candidates as never, payload);
    const comment = formatRelationshipComment(relationships);
    if (comment) {
      await github.comment(createdIssueNumber, comment);
      write("Posted possible duplicate/related issue comment.\n");
    }
  } catch (error) {
    write(`Warning: dedupe comment skipped. ${formatError(error)}\n`);
  }
}

function normalizeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const label of labels.map((value) => value.trim()).filter(Boolean)) {
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(label);
    }
  }
  return normalized;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
