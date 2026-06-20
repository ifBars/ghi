import { CodexIssueGenerator, type IssueGenerator } from "../ai/codexIssueGenerator.js";
import { loadConfig, type ConfigOverrides } from "../core/config.js";
import type { CreatedIssue, GitContext, IssuePayload, IssueTemplate } from "../core/domain.js";
import { appendHiddenMetadata, buildMetadata } from "../core/metadata.js";
import { getGitContext } from "../integrations/git.js";
import { GithubCli } from "../integrations/githubCli.js";
import { buildDedupeSearchQuery, formatRelationshipComment, rankSimpleRelationships } from "../intake/dedupe.js";
import { collectSourceContexts, extractUrlsFromText } from "../intake/sources.js";
import { discoverIssueTemplates } from "../intake/templates.js";
import { assessIssueQuality, formatQualityWarnings, type IssueQualityReport } from "../intake/quality.js";
import { askClarificationQuestions, reviewIssueInTerminal } from "../ui/review.js";

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
  urls?: string[];
  quotes?: string[];
  explore?: boolean;
  fetchUrls?: boolean;
  screenshots?: string[];
  clarify?: boolean;
};

export type CreateFlowDeps = {
  getGitContext?: (cwd: string) => Promise<GitContext>;
  discoverIssueTemplates?: (repoRoot: string) => Promise<IssueTemplate[]>;
  issueGenerator?: IssueGenerator;
  githubFactory?: (repoRoot: string) => GithubClient;
  reviewIssue?: (payload: IssuePayload) => Promise<boolean>;
  collectSourceContexts?: typeof collectSourceContexts;
  write?: (message: string) => void;
  askClarificationQuestions?: (questions: string[]) => Promise<string[]>;
};

export async function runCreateIssueFlow(
  roughInput: string,
  options: CreateFlowOptions,
  deps: CreateFlowDeps = {},
): Promise<{ payload: IssuePayload; createdIssue: CreatedIssue | null }> {
  const config = loadConfig({
    creationMode: options.review
      ? "terminal_review"
      : options.now
        ? "immediate_draft"
        : options.creationMode,
  });
  const write = deps.write ?? ((message) => process.stdout.write(message));

  const gitContext = await (deps.getGitContext ?? getGitContext)(options.cwd);
  const templates = await (deps.discoverIssueTemplates ?? discoverIssueTemplates)(gitContext.root);
  const urls = normalizeList([...(options.urls ?? []), ...extractUrlsFromText(roughInput)]);
  const quotes = normalizeList(options.quotes ?? []);
  const sources = await (deps.collectSourceContexts ?? collectSourceContexts)({
    urls,
    quotes,
    fetchUrls: options.fetchUrls ?? true,
  });
  const issueGenerator = deps.issueGenerator ?? new CodexIssueGenerator();
  const generationInput = {
    roughInput,
    git: gitContext,
    templates,
    sources,
    exploreSources: Boolean(options.explore || urls.length > 0),
    screenshots: options.screenshots ?? [],
    clarificationNotes: options.clarify ? [] : undefined,
  };
  const askClarification = deps.askClarificationQuestions ?? askClarificationQuestions;
  const { payload, quality } = await generateMaintainerReadyIssue(
    issueGenerator,
    generationInput,
    roughInput,
    write,
    options.clarify ?? false,
    askClarification,
  );
  const qualityWarnings = formatQualityWarnings(quality);
  if (qualityWarnings) {
    write(qualityWarnings);
  }
  if (quality.blocking.length > 0) {
    throw new Error(`Issue draft failed quality gates: ${quality.blocking.join(" ")}`);
  }

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

  const github = deps.githubFactory?.(gitContext.root) ?? new GithubCli({
    cwd: gitContext.root,
    repositoryFullName: getRepositoryFullName(gitContext),
  });
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

async function generateMaintainerReadyIssue(
  issueGenerator: IssueGenerator,
  input: Parameters<IssueGenerator["generate"]>[0],
  roughInput: string,
  write: (message: string) => void,
  clarify: boolean,
  askClarificationQuestions: (questions: string[]) => Promise<string[]>,
): Promise<{ payload: IssuePayload; quality: IssueQualityReport }> {
  let payload = await issueGenerator.generate(input);
  let quality = assessIssueQuality(roughInput, payload);
  let clarificationNotes: string[] = [];

  if (clarify && shouldRequestQualityRevision(quality)) {
    const questions = buildClarificationQuestions(quality);
    if (questions.length > 0) {
      write("Issue quality is below target. Asking follow-up clarification questions.\n");
      clarificationNotes = await askClarificationQuestions(questions);
      if (clarificationNotes.length > 0) {
        payload = await issueGenerator.generate({
          ...input,
          previousDraft: payload,
          revisionFeedback: quality.revisionFeedback,
          clarificationNotes,
        });
        quality = assessIssueQuality(roughInput, payload);
      }
    }
  }

  for (let attempt = 1; attempt <= 2 && shouldRequestQualityRevision(quality); attempt += 1) {
    write(`Quality revision ${attempt}: issue draft scored ${quality.score.total}/${quality.score.maximum}; asking Codex to revise with scoring feedback.\n`);
    payload = await issueGenerator.generate({
      ...input,
      previousDraft: payload,
      revisionFeedback: quality.revisionFeedback,
      clarificationNotes: clarificationNotes.length > 0 ? clarificationNotes : input.clarificationNotes,
    });
    quality = assessIssueQuality(roughInput, payload);
  }

  return { payload, quality };
}

function shouldRequestQualityRevision(quality: IssueQualityReport): boolean {
  return quality.blocking.length > 0 || quality.score.total < 75;
}

function buildClarificationQuestions(quality: IssueQualityReport): string[] {
  const questions = new Set<string>();
  const dimensionNames = [
    "expected_observed_repro",
    "specificity",
    "evidence",
    "uncertainty_hygiene",
    "scope_control",
    "template_fit",
  ];

  for (const feedback of quality.revisionFeedback) {
    const lower = feedback.toLowerCase();
    if (lower.includes("observed") && lower.includes("actual")) {
      questions.add("What exact observed behavior and steps should I include in the issue body?");
      continue;
    }
    if (lower.includes("expected behavior")) {
      questions.add("What is the expected behavior or outcome, and where does it currently fail?");
      continue;
    }
    if (lower.includes("reproduction") || lower.includes("steps")) {
      questions.add("Can you provide concrete, ordered reproduction steps and environment details?");
      continue;
    }
    if (lower.includes("evidence")) {
      questions.add("What evidence (logs, screenshot links, version/build info) should be added for confidence?");
      continue;
    }
    if (lower.includes("specific")) {
      questions.add("Can you share precise identifiers (files, components, classes, or paths) impacted by this issue?");
      continue;
    }
    if (lower.includes("scope")) {
      questions.add("Can you narrow the scope (what is in/out of scope for this issue)?");
      continue;
    }
  }

  for (const warning of quality.warnings) {
    const lower = warning.toLowerCase();
    if (lower.includes("local filesystem path") || lower.includes("filesystem path")) {
      questions.add("Should we remove local filesystem paths from the issue body? If needed, what alternative maintainer-facing context should replace them?");
      continue;
    }
    if (lower.includes("rough-input mechanics")) {
      questions.add("Can you provide any maintainer-facing wording to replace placeholder or rough-input language?");
      continue;
    }
    if (lower.includes("placeholder")) {
      questions.add("What concrete phrasing should replace placeholder/instructional wording?");
      continue;
    }
  }

  for (const dimension of dimensionNames) {
    if (quality.revisionFeedback.some((feedback) => feedback.toLowerCase().includes(dimension))) {
      questions.add(`What additional details would strengthen the issue's ${dimension.replace(/_/g, " ")} section?`);
    }
  }

  return [...questions].slice(0, 4);
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

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function extractCreatedIssueUrl(output: string): string | null {
  const match = output.match(/Created issue:\s*(https?:\/\/[^\s]+)/);
  return match ? match[1] : null;
}

function getRepositoryFullName(gitContext: GitContext): string | null {
  return gitContext.remoteOwner && gitContext.remoteName
    ? `${gitContext.remoteOwner}/${gitContext.remoteName}`
    : null;
}
