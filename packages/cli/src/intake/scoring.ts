import type { IssuePayload } from "../core/domain.js";

export type ScoredIssue = {
  repo: string;
  number: number | null;
  title: string;
  body: string;
  labels: string[];
  state?: string | null;
  url?: string | null;
  source?: string | null;
};

export type DimensionScore = {
  name: string;
  score: number;
  maximum: number;
  notes: string[];
};

export type IssueScore = {
  issue: ScoredIssue;
  total: number;
  maximum: number;
  grade: "excellent" | "usable" | "weak" | "bad";
  dimensions: DimensionScore[];
  warnings: string[];
};

export type AuditFinding = {
  source: string;
  identifier: string;
  message: string;
};

export type CorpusCheckResult = {
  name: string;
  paths: string[];
  summary: ScoreSummary;
  gates: ScoreGates;
  failures: string[];
};

export type ScoreSummary = {
  count: number;
  average: number;
  minimum: number;
  maximum: number;
};

export type ScoreGates = {
  minScore?: number;
  minAverage?: number;
  maxScore?: number;
  maxAverage?: number;
};

type IssueRecord = Record<string, unknown>;

export function issueFromPayload(payload: IssuePayload): ScoredIssue {
  return {
    repo: "generated/issue",
    number: null,
    title: payload.title,
    body: payload.body,
    labels: payload.labels,
    state: null,
    url: null,
  };
}

export function normalizeIssue(record: IssueRecord): ScoredIssue {
  const labels = normalizeLabels(record.labels);
  const url = typeof record.url === "string" ? record.url : null;
  const repo = inferRepo(record, url);
  const number = record.number;

  return {
    repo: repo || "unknown/repo",
    number: typeof number === "number" ? number : typeof number === "string" && /^\d+$/.test(number) ? Number(number) : null,
    title: String(record.title ?? "").trim(),
    body: String(record.body ?? "").trim(),
    labels,
    state: record.state == null ? null : String(record.state),
    url,
    source: record._source == null ? null : String(record._source),
  };
}

export function scoreIssue(issue: ScoredIssue): IssueScore {
  const dimensions = [
    scoreActionability(issue),
    scoreBehavior(issue),
    scoreSpecificity(issue),
    scoreEvidence(issue),
    scoreScope(issue),
    scoreTemplateFit(issue),
    scoreUncertainty(issue),
    scoreTone(issue),
    scoreHygiene(issue),
  ];
  const total = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  const maximum = dimensions.reduce((sum, dimension) => sum + dimension.maximum, 0);
  const warnings = dimensions.flatMap((dimension) =>
    dimension.notes
      .filter((note) => note.startsWith("warn:"))
      .map((note) => note.replace(/^warn:\s*/, "")),
  );

  return {
    issue,
    total,
    maximum,
    grade: gradeFor(total, maximum),
    dimensions,
    warnings,
  };
}

export function auditCorpus(records: IssueRecord[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const seen = new Map<string, string>();

  for (const record of records) {
    const source = String(record._source ?? "<unknown>");
    const issue = normalizeIssue(record);
    const identifier = issueIdentifier(issue);
    const duplicateSource = seen.get(identifier);
    if (duplicateSource) {
      findings.push({ source, identifier, message: `duplicate issue also appears in ${duplicateSource}` });
    } else {
      seen.set(identifier, source);
    }

    for (const fieldName of ["repo", "number", "title", "body", "url", "corpus", "curation"]) {
      if (!record[fieldName]) {
        findings.push({ source, identifier, message: `missing required field: ${fieldName}` });
      }
    }

    if (issue.url && !issue.url.endsWith(`/${issue.number}`)) {
      findings.push({ source, identifier, message: "url does not end with the issue number" });
    }
    if (issue.url && !issue.url.includes(`github.com/${issue.repo}/issues/`)) {
      findings.push({ source, identifier, message: "url does not match repo issue path" });
    }

    const corpus = String(record.corpus ?? "");
    const curation = isObject(record.curation) ? record.curation : {};
    const label = String(curation.label ?? "");
    const expectedLabel = expectedCurationLabel(corpus);
    if (expectedLabel && label !== expectedLabel) {
      findings.push({ source, identifier, message: `curation.label should be '${expectedLabel}' for corpus '${corpus}'` });
    }
    if (!String(curation.reason ?? "").trim()) {
      findings.push({ source, identifier, message: "curation.reason is required" });
    }

    if (corpus === "maintainer-rejected") {
      auditRejectedRecord(record, source, identifier, findings);
    }
  }

  return findings;
}

export function summarize(scores: IssueScore[]): ScoreSummary {
  const totals = scores.map((score) => score.total);
  return {
    count: scores.length,
    average: totals.length ? round(mean(totals), 2) : 0,
    minimum: totals.length ? Math.min(...totals) : 0,
    maximum: totals.length ? Math.max(...totals) : 0,
  };
}

export function gateFailures(scores: IssueScore[], gates: ScoreGates): string[] {
  const failures: string[] = [];
  const average = summarize(scores).average;
  if (gates.minScore !== undefined && scores.some((score) => score.total < gates.minScore!)) {
    failures.push(`at least one issue scored below ${gates.minScore}`);
  }
  if (gates.minAverage !== undefined && average < gates.minAverage) {
    failures.push(`average ${average} is below ${gates.minAverage}`);
  }
  if (gates.maxScore !== undefined && scores.some((score) => score.total > gates.maxScore!)) {
    failures.push(`at least one issue scored above ${gates.maxScore}`);
  }
  if (gates.maxAverage !== undefined && average > gates.maxAverage) {
    failures.push(`average ${average} is above ${gates.maxAverage}`);
  }
  return failures;
}

export function formatScoreRevisionFeedback(score: IssueScore, targetScore = 75): string[] {
  const lines = [`Current issue quality score: ${score.total}/${score.maximum} (${score.grade}). Target at least ${targetScore}/100.`];
  const weakDimensions = score.dimensions
    .filter((dimension) => dimension.score < Math.ceil(dimension.maximum * 0.7) || dimension.notes.length > 0)
    .sort((left, right) => left.score / left.maximum - right.score / right.maximum)
    .slice(0, 6);

  for (const dimension of weakDimensions) {
    const note = dimension.notes.map((value) => value.replace(/^warn:\s*/, "")).join("; ");
    lines.push(`${dimension.name}: ${dimension.score}/${dimension.maximum}. ${dimensionGuidance(dimension.name)}${note ? ` Current issue: ${note}.` : ""}`);
  }

  return lines;
}

export function scoreToJson(score: IssueScore): Record<string, unknown> {
  return {
    repo: score.issue.repo,
    number: score.issue.number,
    title: score.issue.title,
    url: score.issue.url,
    total: score.total,
    maximum: score.maximum,
    grade: score.grade,
    dimensions: score.dimensions,
    warnings: score.warnings,
  };
}

export function markdownReport(scores: IssueScore[]): string {
  const lines = ["# Issue Quality Report", ""];
  const summary = summarize(scores);
  lines.push(`Scored ${summary.count} issues. Average: ${summary.average}/100. Range: ${summary.minimum}-${summary.maximum}.`);
  lines.push("");

  for (const score of [...scores].sort((left, right) => left.total - right.total)) {
    const identifier = issueIdentifier(score.issue);
    lines.push(`## ${identifier} - ${score.total}/${score.maximum} (${score.grade})`);
    lines.push(`Title: ${score.issue.title}`);
    if (score.issue.url) {
      lines.push(`URL: ${score.issue.url}`);
    }
    lines.push("");
    for (const dimension of score.dimensions) {
      lines.push(`- ${dimension.name}: ${dimension.score}/${dimension.maximum}`);
    }
    if (score.warnings.length > 0) {
      lines.push("");
      lines.push("Warnings:");
      for (const warning of score.warnings) {
        lines.push(`- ${warning}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function scoreActionability(issue: ScoredIssue): DimensionScore {
  const notes: string[] = [];
  let points = 0;
  if (issue.title.length >= 12) {
    points += 4;
  } else {
    notes.push("warn:title is too short to carry the issue");
  }
  if (wordCount(issue.body) >= 60) {
    points += 5;
  } else if (wordCount(issue.body) >= 25) {
    points += 3;
  } else {
    notes.push("warn:body is too thin for maintainer action");
  }
  if (hasAny(issue.body, ["summary", "context", "problem", "impact"])) points += 4;
  if (hasAny(issue.body, ["acceptance", "done when", "task", "fix", "proposal", "expected"])) points += 4;
  if (hasMaintainerAction(issue)) points += 3;
  if (hasMaintenanceTask(issue)) points += 4;
  if (hasConcreteIdentifier(issue.body) && wordCount(issue.body) >= 15) points += 2;
  if (issue.labels.length > 0) points += 3;
  const placeholders = templatePlaceholderCounts(issue.body);
  if (placeholders.strong >= 2 || placeholders.blank >= 4) {
    points = Math.min(points - 8, 8);
    notes.push("warn:template placeholders are still present");
  } else if (hasAny(issue.body, ["obvious", "_no response_"]) && wordCount(issue.body) < 50) {
    points -= 8;
    notes.push("warn:request is too thin to preserve as a maintainer-ready issue");
  }
  return { name: "actionability", score: clamp(points, 0, 20), maximum: 20, notes };
}

function scoreBehavior(issue: ScoredIssue): DimensionScore {
  const notes: string[] = [];
  const isBug = issue.labels.some((label) => label.toLowerCase() === "bug") || hasAny(issue.title, ["bug", "crash", "fail", "regression"]);
  let points = isBug ? 0 : 4;
  if (!isBug && hasMaintainerAction(issue) && hasConcreteIdentifier(`${issue.title}\n${issue.body}`)) points += 4;
  if (!isBug && hasMaintenanceTask(issue)) points += 4;
  if (!isBug && hasMeaningfulUseCase(issue.body)) points += 4;
  if (!isBug && hasConcreteIdentifier(`${issue.title}\n${issue.body}`)) points += 3;
  if (hasAny(issue.body, ["observed", "actual", "what happened"]) || (isBug && hasObservedOutcome(issue.body))) {
    points += 4;
  } else if (isBug) {
    notes.push("warn:bug lacks observed or actual behavior");
  }
  if (hasAny(issue.body, ["expected", "should happen", "expect "]) || (isBug && hasExpectedOutcome(issue.body))) {
    points += 4;
  } else if (isBug) {
    notes.push("warn:bug lacks expected behavior");
  }
  if (hasReproductionDetails(issue.body)) {
    points += 4;
  } else if (isBug) {
    notes.push("warn:bug lacks reproduction steps");
  }
  if (hasAny(issue.body, ["environment", "version", "build", "platform", "commit"])) points += 3;
  return { name: "expected_observed_repro", score: clamp(points, 0, 15), maximum: 15, notes };
}

function scoreSpecificity(issue: ScoredIssue): DimensionScore {
  const notes: string[] = [];
  let points = 0;
  if (/\b[\w.-]+\.(ts|tsx|js|py|rs|cs|go|java|md|yml|yaml)\b/.test(issue.body)) points += 4;
  if (/`[^`]{3,}`/.test(issue.body) || hasRealCodeFence(issue.body)) points += 3;
  if (/\b(v?\d+\.\d+|\d{4}-\d{2}-\d{2}|#[0-9]+)\b/.test(issue.body)) points += 3;
  if (hasAny(issue.body, ["command", "stack", "trace", "log", "output", "request", "response"])) points += 3;
  if (hasConcreteIdentifier(`${issue.title}\n${issue.body}`)) points += 4;
  if (hasAny(issue.body, ["scenario", "steps to reproduce", "steps to repro"]) || /^\s*\d+\.\s+/m.test(issue.body)) points += 3;
  if (hasAny(issue.body, ["saw it in", "from ", "within "]) && hasConcreteIdentifier(issue.body)) points += 3;
  if (hasMaintenanceTask(issue)) points += 3;
  if (hasExternalReferenceEvidence(issue.body)) points += 4;
  if (uniqueWords(issue.body).size >= 40) {
    points += 2;
  } else {
    notes.push("warn:issue lacks concrete domain detail");
  }
  return { name: "specificity", score: clamp(points, 0, 15), maximum: 15, notes };
}

function scoreEvidence(issue: ScoredIssue): DimensionScore {
  const notes: string[] = [];
  let points = 0;
  if (/https?:\/\//.test(issue.body)) points += 3;
  if (hasRealCodeFence(issue.body)) points += 4;
  if (hasAny(issue.body, ["screenshot", "image", "recording", "attachment", "evidence"])) points += 3;
  if (hasAny(issue.body, ["log", "trace", "error", "exception", "console"])) points += 3;
  if (hasAny(issue.body, ["verified", "confirmed", "source", "reported", "unknown"])) points += 2;
  if (hasConcreteIdentifier(issue.body) && hasUseCase(issue.body)) points += 4;
  if (/^\s*\d+\.\s+/m.test(issue.body) && hasAny(issue.body, ["version", "environment", "platform", "build"])) points += 3;
  if (hasAny(issue.body, ["saw it in", "from ", "within "]) && hasConcreteIdentifier(issue.body)) points += 3;
  if (hasMaintenanceTask(issue) && hasAny(issue.body, ["should", "fixing", "current", "currently", "instead", "previous", "typo"])) points += 3;
  if (hasExternalReferenceEvidence(issue.body)) points += 4;
  if (points < 5) notes.push("warn:issue has little explicit evidence");
  return { name: "evidence", score: clamp(points, 0, 15), maximum: 15, notes };
}

function scoreScope(issue: ScoredIssue): DimensionScore {
  const notes: string[] = [];
  let points = 10;
  if (issue.title.length > 140) {
    points -= 3;
    notes.push("warn:title is too broad or overloaded");
  }
  if (wordCount(issue.body) > 900) {
    points -= 3;
    notes.push("warn:body is large enough to risk mixed scope");
  }
  if (hasAny(issue.body, ["thinking out loud", "not saying", "curious how", "thought / idea"])) {
    points -= 5;
    notes.push("warn:issue is framed as exploratory discussion instead of a concrete maintainer task");
  }
  if ((issue.body.match(/\n\s*[-*]\s+/g) ?? []).length > 18) {
    points -= 2;
    notes.push("warn:many bullets may indicate a grab bag");
  }
  if (hasAny(issue.body, ["also fix", "while we're here", "unrelated"])) {
    points -= 3;
    notes.push("warn:scope appears mixed");
  }
  return { name: "scope_control", score: clamp(points, 0, 10), maximum: 10, notes };
}

function scoreTemplateFit(issue: ScoredIssue): DimensionScore {
  let points = Math.min((issue.body.match(/^#{2,6}\s+/gm) ?? []).length * 2, 6);
  if (hasAny(issue.body, ["missing information", "unknown", "assumptions"])) points += 2;
  if (hasAny(issue.body, ["acceptance criteria", "expected behavior", "reproduction"])) points += 2;
  if (points === 0 && hasMaintainerAction(issue) && hasConcreteIdentifier(`${issue.title}\n${issue.body}`) && hasUseCase(issue.body)) {
    points = 4;
  }
  if (points === 0 && hasMaintenanceTask(issue)) {
    points = 4;
  }
  const placeholders = templatePlaceholderCounts(issue.body);
  const notes = points >= 6 ? [] : ["warn:issue may not map cleanly to a maintainer template"];
  if (placeholders.strong >= 2) {
    points -= 8;
    notes.push("warn:template contains unfilled placeholder text");
  } else if (placeholders.strong > 0 || placeholders.blank >= 4) {
    points -= 4;
    notes.push("warn:template contains unfilled placeholder text");
  } else if (placeholders.blank >= 2) {
    points -= 1;
    notes.push("warn:template contains unfilled placeholder text");
  }
  return { name: "template_fit", score: clamp(points, 0, 10), maximum: 10, notes };
}

function scoreUncertainty(issue: ScoredIssue): DimensionScore {
  let points = hasAny(issue.body, ["unknown", "unclear", "not verified", "needs confirmation", "assumption"]) ? 3 : 0;
  if (hasAny(issue.body, ["definitely", "guaranteed", "always"]) && !hasAny(issue.body, ["repro", "verified", "confirmed"])) {
    points = Math.max(points - 2, 0);
    return { name: "uncertainty_hygiene", score: clamp(points, 0, 5), maximum: 5, notes: ["warn:absolute claim lacks verification language"] };
  }
  return { name: "uncertainty_hygiene", score: clamp(points + 2, 0, 5), maximum: 5, notes: [] };
}

function scoreTone(issue: ScoredIssue): DimensionScore {
  const text = `${issue.title}\n${issue.body}`;
  let points = 5;
  if (/\b(obviously|stupid|broken af|wtf|fuck|fucking|shit|just fix)\b/i.test(text)) points -= 3;
  if (/[A-Z]{8,}/.test(text)) points -= 1;
  return { name: "maintainer_tone", score: clamp(points, 0, 5), maximum: 5, notes: [] };
}

function scoreHygiene(issue: ScoredIssue): DimensionScore {
  const notes: string[] = [];
  let points = 5;
  if (/\b(ai-generated|generated by ai|generated by codex|as an ai)\b/i.test(issue.body)) {
    points -= 3;
    notes.push("warn:visible AI disclosure leaks generation mechanics");
  }
  if (/\b[A-Z]:[\\/][^\s)`]+/.test(issue.body)) {
    points -= 1;
    notes.push("warn:local filesystem path is exposed");
  }
  if (/(ghp_|github_pat_|sk-[A-Za-z0-9])/.test(issue.body)) {
    points = 0;
    notes.push("warn:possible secret/token exposure");
  }
  if (hasAny(issue.body, ["raw prompt", "rough input"])) {
    points -= 1;
    notes.push("warn:rough-input mechanics may be exposed");
  }
  if (hasAny(issue.body, ["please fill in each section", "your code here", "what search terms did you use"])) {
    points -= 2;
    notes.push("warn:issue template instructions are visible");
  }
  return { name: "hygiene", score: clamp(points, 0, 5), maximum: 5, notes };
}

function auditRejectedRecord(record: IssueRecord, source: string, identifier: string, findings: AuditFinding[]): void {
  const curation = isObject(record.curation) ? record.curation : {};
  if (String(record.state ?? "").toUpperCase() !== "CLOSED") {
    findings.push({ source, identifier, message: "maintainer-rejected issue must be closed" });
  }
  const allowedKinds = new Set([
    "duplicate",
    "needs-more-info",
    "needs-reproduction",
    "not-planned",
    "support-question",
    "unactionable",
    "unfilled-template",
    "unfinished-template",
  ]);
  const rejectionKind = String(curation.rejectionKind ?? "");
  if (!allowedKinds.has(rejectionKind)) {
    findings.push({ source, identifier, message: `unsupported rejectionKind: ${rejectionKind || "<missing>"}` });
  }
  const evidence = curation.maintainerEvidence;
  if (!Array.isArray(evidence) || !evidence.some((item) => String(item).trim())) {
    findings.push({ source, identifier, message: "maintainerEvidence must include at least one explicit maintainer or triager phrase" });
  }
}

function expectedCurationLabel(corpus: string): string | null {
  if (corpus === "scheduleone-good" || corpus === "production-good") return "good";
  if (corpus === "scheduleone-weak") return "weak";
  if (corpus === "maintainer-rejected") return "maintainer-rejected";
  return null;
}

function issueIdentifier(issue: ScoredIssue): string {
  return issue.number === null ? issue.repo : `${issue.repo}#${issue.number}`;
}

function gradeFor(total: number, maximum: number): IssueScore["grade"] {
  const percent = maximum === 0 ? 0 : total / maximum;
  if (percent >= 0.9) return "excellent";
  if (percent >= 0.66) return "usable";
  if (percent >= 0.55) return "weak";
  return "bad";
}

function dimensionGuidance(name: string): string {
  const guidance: Record<string, string> = {
    actionability: "Add a clear summary, impact, and the maintainer action needed.",
    expected_observed_repro: "Separate observed behavior, expected behavior, reproduction steps, and environment details.",
    specificity: "Name concrete files, APIs, commands, versions, stack traces, or affected components.",
    evidence: "Include logs, screenshots, links, source context, or verified reproduction evidence.",
    scope_control: "Keep the issue focused on one root problem and move unrelated asks out.",
    template_fit: "Map the draft into the repository issue template and remove unfilled placeholders.",
    uncertainty_hygiene: "Mark unknowns and assumptions explicitly instead of asserting unverified facts.",
    maintainer_tone: "Use neutral, concise maintainer-facing language.",
    hygiene: "Remove visible generation mechanics, local-only paths, raw prompts, and secrets.",
  };
  return guidance[name] ?? "Improve this dimension before finalizing the issue.";
}

function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((label) => isObject(label) ? label.name : label)
    .map((label) => String(label ?? "").trim())
    .filter(Boolean);
}

function inferRepo(record: IssueRecord, url: string | null): string {
  const repo = String(record.repo ?? record.repository ?? "").trim();
  if (repo) return repo;
  const match = url?.match(/github\.com\/([^/]+\/[^/]+)\/issues\/\d+/);
  return match?.[1] ?? "";
}

function templatePlaceholderCounts(value: string): { strong: number; blank: number } {
  const strongPatterns = [
    /_{4,}/gi,
    /\/\/ Your code here/gi,
    /Please fill in each section/gi,
    /What search terms did you use/gi,
    /List them here/gi,
    /I was unable to test this on prior versions because/gi,
  ];
  return {
    strong: strongPatterns.reduce((sum, pattern) => sum + (value.match(pattern) ?? []).length, 0),
    blank: (value.match(/_No response_/gi) ?? []).length,
  };
}

function hasAny(value: string, terms: string[]): boolean {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function hasMaintainerAction(issue: ScoredIssue): boolean {
  return issue.labels.some((label) => label.toLowerCase() === "enhancement")
    || hasAny(`${issue.title}\n${issue.body}`, [
      "add ",
      "expose ",
      "feature request",
      "provide ",
      "support ",
      "wrap ",
    ]);
}

function hasMaintenanceTask(issue: ScoredIssue): boolean {
  const text = `${issue.title}\n${issue.body}`;
  return issue.labels.some((label) => hasAny(label, ["tech-debt", "documentation", "docs"]))
    || (hasAny(text, ["readme", "docs", "documentation", "typo", "spelling"]) && hasAny(text, ["should", "fix", "correct", "rename", "typo"]))
    || (hasAny(text, ["refactor", "reference", "rename"]) && hasConcreteIdentifier(text))
    || (hasAny(text, ["sha pin", "pin ", "dependency", "dependabot", "installer", "sdk installer"]) && wordCount(text) >= 20)
    || (hasAny(text, ["specification", "web platform", "standards", "integration"]) && hasExternalReferenceEvidence(text));
}

function hasExternalReferenceEvidence(value: string): boolean {
  return /https?:\/\/[^\s)]+/.test(value) && hasAny(value, ["pull", "pr", "spec", "test", "wpt", "github.com", "marketplace"]);
}

function hasUseCase(value: string): boolean {
  return hasAny(value, [
    "because",
    "can ",
    "devs",
    "easier",
    "help",
    "modders",
    "requires",
    "so ",
    "so that",
    "to be able",
    "without",
    "would ",
  ]);
}

function hasMeaningfulUseCase(value: string): boolean {
  if (hasAny(value, ["obvious", "_no response_", "n/a"])) return false;
  return hasUseCase(value);
}

function hasConcreteIdentifier(value: string): boolean {
  return /`[^`]{3,}`/.test(value)
    || /\b[A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)+\b/.test(value)
    || /\b[A-Z][A-Za-z0-9_]*(?:App|API|Entity|Manager|Pass|View|Loader|Storage|Time|NPC)s?\b/.test(value)
    || /\b[A-Z][A-Za-z0-9_]*\(/.test(value);
}

function hasRealCodeFence(value: string): boolean {
  return /```[\s\S]*?```/.test(value) && !hasAny(value, ["// your code here", "please fill in each section"]);
}

function hasObservedOutcome(value: string): boolean {
  return hasAny(value, [
    "crashes",
    "does not",
    "don't",
    "error",
    "fails",
    "is no longer",
    "missing",
    "not always present",
    "no longer present",
    "throws",
  ]);
}

function hasExpectedOutcome(value: string): boolean {
  return hasAny(value, [
    "expect ",
    "expected",
    "should",
    "supposed to",
  ]);
}

function hasReproductionDetails(value: string): boolean {
  const lower = value.toLowerCase();
  if (/^\s*\d+\.\s+/m.test(value)) return true;
  if (/(steps|scenario|to reproduce|repro steps|reproduction steps)/i.test(value) && !lower.includes("optional if provided reproduction")) return true;
  return false;
}

function wordCount(value: string): number {
  return value.match(/\b\w+\b/g)?.length ?? 0;
}

function uniqueWords(value: string): Set<string> {
  return new Set((value.match(/\b[a-zA-Z][a-zA-Z0-9_-]{2,}\b/g) ?? []).map((word) => word.toLowerCase()));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
