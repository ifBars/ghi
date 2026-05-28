import { appendFileSync, readFileSync } from "node:fs";
import { normalizeIssue, scoreIssue, type DimensionScore, type IssueScore } from "../intake/scoring.js";

const marker = "<!-- ghi-score-guidance -->";
const scoreLabels = ["0.x", "1.x", "2.x", "3.x", "4.x", "5.x", "6.x", "7.x", "8.x", "9.x", "10.0"];
const gradeLabels = ["bad", "weak", "usable", "excellent"];

type ActionConfig = {
  token: string;
  applyLabels: boolean;
  scoreLabelPrefix: string;
  gradeLabelPrefix: string;
  commentOnLowScore: boolean;
  lowScoreThreshold: number;
  failOnLowScore: boolean;
  ignoreMaintainerAuthored: boolean;
  createLabels: boolean;
};

type GitHubIssueEvent = {
  action?: string;
  issue?: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    author_association?: string;
    labels?: Array<{ name?: string } | string>;
    pull_request?: unknown;
    user?: { login?: string };
  };
  repository?: {
    full_name: string;
    owner?: { login?: string };
    name?: string;
  };
};

type GitHubComment = {
  id: number;
  body?: string | null;
  user?: { login?: string };
};

type GitHubLabel = {
  name: string;
};

export function scoreToTen(total: number): string {
  return (Math.round(total) / 10).toFixed(1);
}

export function scoreBucket(score: string): string {
  const value = Number(score);
  if (!Number.isFinite(value)) return "0.x";
  if (value >= 10) return "10.0";
  return `${Math.max(0, Math.min(9, Math.floor(value)))}.x`;
}

export function buildGuidanceComment(score: IssueScore, tenPointScore: string, threshold: number): string {
  const weakDimensions = score.dimensions
    .filter((dimension) => dimension.score < Math.ceil(dimension.maximum * 0.7) || dimension.notes.length > 0)
    .sort((left, right) => left.score / left.maximum - right.score / right.maximum)
    .slice(0, 4);

  const guidance = weakDimensions.map((dimension) => `- **${dimensionLabel(dimension.name)}:** ${dimensionGuidance(dimension)}`);
  return [
    marker,
    `Thanks for opening this. This issue currently scores **${tenPointScore}/10.0** for maintainer actionability, below this repository's guidance threshold of **${threshold.toFixed(1)}/10.0**.`,
    "",
    "More context would make it easier to triage:",
    "",
    ...(guidance.length > 0 ? guidance : ["- Add concrete context, expected outcome, actual outcome, and evidence so maintainers can act without guessing."]),
    "",
    "You can edit the issue body directly. This comment will update automatically when the issue is edited.",
  ].join("\n");
}

export function shouldComment(score: number, threshold: number, authorAssociation: string | undefined, ignoreMaintainerAuthored: boolean): boolean {
  if (score >= threshold) return false;
  if (!ignoreMaintainerAuthored) return true;
  return !["COLLABORATOR", "MEMBER", "OWNER"].includes(String(authorAssociation ?? "").toUpperCase());
}

export function labelsForScore(score: string, grade: string, scoreLabelPrefix: string, gradeLabelPrefix: string): string[] {
  return [`${scoreLabelPrefix}${scoreBucket(score)}`, `${gradeLabelPrefix}${grade}`];
}

async function main(): Promise<void> {
  const config = readConfig(process.env);
  const event = readEvent(process.env.GITHUB_EVENT_PATH);
  if (!event.issue || !event.repository) {
    log("No issue payload found; skipping.");
    return;
  }
  if (event.issue.pull_request) {
    log("Issue payload is a pull request; skipping.");
    return;
  }

  const score = scoreIssue(normalizeIssue({
    repo: event.repository.full_name,
    number: event.issue.number,
    title: event.issue.title,
    body: event.issue.body ?? "",
    labels: event.issue.labels ?? [],
    url: event.issue.html_url,
  }));
  const tenPointScore = scoreToTen(score.total);
  const numericScore = Number(tenPointScore);
  const shouldWriteComment = config.commentOnLowScore
    && shouldComment(numericScore, config.lowScoreThreshold, event.issue.author_association, config.ignoreMaintainerAuthored);

  let labelsApplied = false;
  let commented = false;
  if (config.applyLabels || shouldWriteComment) {
    requireToken(config.token);
  }
  const api = new GitHubApi(config.token, event.repository.full_name, event.issue.number);

  if (config.applyLabels) {
    await syncScoreLabels(api, labelsForScore(tenPointScore, score.grade, config.scoreLabelPrefix, config.gradeLabelPrefix), config);
    labelsApplied = true;
  }

  if (shouldWriteComment) {
    await upsertGuidanceComment(api, event.issue.number, buildGuidanceComment(score, tenPointScore, config.lowScoreThreshold));
    commented = true;
  } else if (config.commentOnLowScore && config.token) {
    await deleteGuidanceComment(api, event.issue.number);
  }

  writeOutput("score", tenPointScore);
  writeOutput("score-percent", String(score.total));
  writeOutput("grade", score.grade);
  writeOutput("commented", String(commented));
  writeOutput("labels-applied", String(labelsApplied));

  log(`ghi score: ${tenPointScore}/10.0 (${score.grade}) for ${event.repository.full_name}#${event.issue.number}`);
  if (config.failOnLowScore && numericScore < config.lowScoreThreshold) {
    throw new Error(`Issue score ${tenPointScore}/10.0 is below threshold ${config.lowScoreThreshold.toFixed(1)}/10.0`);
  }
}

async function syncScoreLabels(api: GitHubApi, labels: string[], config: ActionConfig): Promise<void> {
  const existing = await api.listLabels();
  const removeNames = existing
    .map((label) => label.name)
    .filter((name) =>
      (name.startsWith(config.scoreLabelPrefix) && !labels.includes(name))
      || (name.startsWith(config.gradeLabelPrefix) && !labels.includes(name)),
    );

  if (config.createLabels) {
    for (const label of labels) {
      if (!existing.some((item) => item.name === label)) {
        await api.createLabel(label, labelColor(label));
      }
    }
  }

  for (const label of removeNames) {
    await api.removeLabel(label);
  }
  await api.addLabels(labels);
}

async function upsertGuidanceComment(api: GitHubApi, issueNumber: number, body: string): Promise<void> {
  const comments = await api.listComments(issueNumber);
  const existing = comments.find((comment) => comment.body?.includes(marker));
  if (existing) {
    await api.updateComment(existing.id, body);
  } else {
    await api.createComment(issueNumber, body);
  }
}

async function deleteGuidanceComment(api: GitHubApi, issueNumber: number): Promise<void> {
  const comments = await api.listComments(issueNumber);
  const existing = comments.find((comment) => comment.body?.includes(marker));
  if (existing) {
    await api.deleteComment(existing.id);
  }
}

class GitHubApi {
  private readonly baseUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";

  constructor(private readonly token: string, private readonly repo: string, private readonly issueNumber: number) {}

  async listLabels(): Promise<GitHubLabel[]> {
    return this.request<GitHubLabel[]>(`/repos/${this.repo}/issues/${this.issueNumber}/labels`);
  }

  async createLabel(name: string, color: string): Promise<void> {
    await this.request(`/repos/${this.repo}/labels`, {
      method: "POST",
      body: JSON.stringify({ name, color }),
      ignoreStatuses: [422],
    });
  }

  async addLabels(labels: string[]): Promise<void> {
    await this.request(`/repos/${this.repo}/issues/${this.issueNumber}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels }),
    });
  }

  async removeLabel(label: string): Promise<void> {
    await this.request(`/repos/${this.repo}/issues/${this.issueNumber}/labels/${encodeURIComponent(label)}`, {
      method: "DELETE",
      ignoreStatuses: [404],
    });
  }

  async listComments(issue: number): Promise<GitHubComment[]> {
    return this.request<GitHubComment[]>(`/repos/${this.repo}/issues/${issue}/comments?per_page=100`);
  }

  async createComment(issue: number, body: string): Promise<void> {
    await this.request(`/repos/${this.repo}/issues/${issue}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  async updateComment(commentId: number, body: string): Promise<void> {
    await this.request(`/repos/${this.repo}/issues/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
  }

  async deleteComment(commentId: number): Promise<void> {
    await this.request(`/repos/${this.repo}/issues/comments/${commentId}`, {
      method: "DELETE",
      ignoreStatuses: [404],
    });
  }

  private async request<T = unknown>(path: string, options: { method?: string; body?: string; ignoreStatuses?: number[] } = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "User-Agent": "ghi-score-action",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: options.body,
    });
    if (options.ignoreStatuses?.includes(response.status)) {
      return undefined as T;
    }
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`GitHub API ${options.method ?? "GET"} ${path} failed with ${response.status}: ${message}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }
}

function readConfig(env: NodeJS.ProcessEnv): ActionConfig {
  return {
    token: env.GHI_GITHUB_TOKEN ?? "",
    applyLabels: parseBoolean(env.GHI_APPLY_LABELS, true),
    scoreLabelPrefix: env.GHI_SCORE_LABEL_PREFIX ?? "ghi-score/",
    gradeLabelPrefix: env.GHI_GRADE_LABEL_PREFIX ?? "ghi-quality/",
    commentOnLowScore: parseBoolean(env.GHI_COMMENT_ON_LOW_SCORE, true),
    lowScoreThreshold: parseThreshold(env.GHI_LOW_SCORE_THRESHOLD),
    failOnLowScore: parseBoolean(env.GHI_FAIL_ON_LOW_SCORE, false),
    ignoreMaintainerAuthored: parseBoolean(env.GHI_IGNORE_MAINTAINER_AUTHORED, true),
    createLabels: parseBoolean(env.GHI_CREATE_LABELS, true),
  };
}

function readEvent(path: string | undefined): GitHubIssueEvent {
  if (!path) {
    throw new Error("GITHUB_EVENT_PATH is required.");
  }
  return JSON.parse(readFileSync(path, "utf8")) as GitHubIssueEvent;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseThreshold(value: string | undefined): number {
  const parsed = Number(value ?? "6.6");
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    throw new Error("low-score-threshold must be a number between 0.0 and 10.0.");
  }
  return parsed;
}

function requireToken(token: string): void {
  if (!token) {
    throw new Error("github-token is required when labels or comments are enabled.");
  }
}

function labelColor(label: string): string {
  if (label.includes("bad")) return "d73a4a";
  if (label.includes("weak")) return "fbca04";
  if (label.includes("usable")) return "2ea44f";
  if (label.includes("excellent")) return "0e8a16";
  return "c5def5";
}

function dimensionLabel(name: string): string {
  const labels: Record<string, string> = {
    actionability: "Actionability",
    expected_observed_repro: "Expected, observed, and repro",
    specificity: "Specificity",
    evidence: "Evidence",
    scope_control: "Scope",
    template_fit: "Template fit",
    uncertainty_hygiene: "Unknowns",
    maintainer_tone: "Tone",
    hygiene: "Safety and hygiene",
  };
  return labels[name] ?? name;
}

function dimensionGuidance(dimension: DimensionScore): string {
  const guidance: Record<string, string> = {
    actionability: "add the maintainer action needed and why it matters",
    expected_observed_repro: "include exact steps, what happened, and what should happen",
    specificity: "name concrete APIs, files, commands, versions, or affected components",
    evidence: "include logs, screenshots, error output, links, or a minimal example",
    scope_control: "keep the issue focused on one root problem",
    template_fit: "fill the repository's issue-template sections and remove placeholders",
    uncertainty_hygiene: "call out assumptions or unknowns explicitly",
    maintainer_tone: "keep the wording neutral and maintainer-facing",
    hygiene: "remove secrets, local-only paths, raw prompts, or template instructions",
  };
  const note = dimension.notes.map((value) => value.replace(/^warn:\s*/, "")).join("; ");
  return `${guidance[dimension.name] ?? "add more maintainer-ready context"}${note ? ` (${note})` : ""}.`;
}

function writeOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    log(`${name}=${value}`);
    return;
  }
  appendFileSync(outputPath, `${name}=${value}\n`, "utf8");
}

function log(message: string): void {
  console.log(message);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
