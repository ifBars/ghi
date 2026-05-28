#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  auditCorpus,
  gateFailures,
  markdownReport,
  normalizeIssue,
  scoreIssue,
  scoreToJson,
  summarize,
  type AuditFinding,
  type CorpusCheckResult,
  type ScoreGates,
} from "../packages/cli/src/intake/scoring.ts";

const defaultFields = "number,title,body,labels,state,stateReason,createdAt,updatedAt,closedAt,url,author";

type JsonRecord = Record<string, unknown>;

type ParsedArgs = {
  command: string | null;
  positionals: string[];
  options: Map<string, string | boolean | string[]>;
};

function main(argv: string[]): number {
  const args = parseArgs(argv);
  try {
    switch (args.command) {
      case "score":
        return runScore(args);
      case "collect":
        return runCollect(args);
      case "audit":
        return runAudit(args);
      case "check":
        return runCheck(args);
      default:
        usage();
        return 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function runScore(args: ParsedArgs): number {
  const records = loadRecords(args.positionals, Boolean(args.options.get("stdin")));
  const scores = records.map((record) => scoreIssue(normalizeIssue(record)));
  const format = stringOption(args, "format") ?? "markdown";
  if (format === "json") {
    console.log(JSON.stringify({ summary: summarize(scores), issues: scores.map(scoreToJson) }, null, 2));
  } else if (format === "jsonl") {
    for (const score of scores) {
      console.log(JSON.stringify(scoreToJson(score)));
    }
  } else {
    console.log(markdownReport(scores));
  }

  const failures = gateFailures(scores, {
    minScore: numberOption(args, "min-score"),
    minAverage: numberOption(args, "min-average"),
    maxScore: numberOption(args, "max-score"),
    maxAverage: numberOption(args, "max-average"),
  });
  for (const failure of failures) {
    console.error(`score gate failed: ${failure}`);
  }
  return failures.length > 0 ? 1 : 0;
}

function runCollect(args: ParsedArgs): number {
  const repos = arrayOption(args, "repo");
  const out = stringOption(args, "out");
  if (repos.length === 0 || !out) {
    throw new Error("collect requires --repo and --out");
  }
  const limit = String(numberOption(args, "limit") ?? 100);
  const state = stringOption(args, "state") ?? "all";
  const lines: string[] = [];
  for (const repo of repos) {
    const result = spawnSync("gh", [
      "issue",
      "list",
      "--repo",
      repo,
      "--limit",
      limit,
      "--state",
      state,
      "--json",
      defaultFields,
    ], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || `gh issue list failed for ${repo}`);
    }
    const issues = JSON.parse(result.stdout) as JsonRecord[];
    for (const issue of issues) {
      lines.push(JSON.stringify({ ...issue, repo }));
    }
  }
  writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
  return 0;
}

function runAudit(args: ParsedArgs): number {
  const findings = auditCorpus(loadRecords(args.positionals, Boolean(args.options.get("stdin"))));
  writeAudit(findings, stringOption(args, "format") ?? "markdown");
  return findings.length > 0 ? 1 : 0;
}

function runCheck(args: ParsedArgs): number {
  const manifestPath = args.positionals[0];
  if (!manifestPath) {
    throw new Error("check requires a manifest path");
  }
  const { auditFindings, results } = checkManifest(manifestPath);
  writeCheck(auditFindings, results, stringOption(args, "format") ?? "markdown");
  return auditFindings.length > 0 || results.some((result) => result.failures.length > 0) ? 1 : 0;
}

function checkManifest(manifestPath: string): { auditFindings: AuditFinding[]; results: CorpusCheckResult[] } {
  const absoluteManifest = resolve(manifestPath);
  const manifest = JSON.parse(readFileSync(absoluteManifest, "utf8")) as { corpora?: unknown[] };
  if (!Array.isArray(manifest.corpora)) {
    throw new Error(`${manifestPath}: expected corpora array`);
  }
  const root = dirname(absoluteManifest);
  const allRecords: JsonRecord[] = [];
  const results: CorpusCheckResult[] = [];

  for (const entry of manifest.corpora) {
    if (!isObject(entry)) {
      throw new Error(`${manifestPath}: corpus entries must be objects`);
    }
    const name = String(entry.name ?? "").trim();
    const paths = Array.isArray(entry.paths) ? entry.paths.map((path) => String(path)) : [];
    const gates = isObject(entry.gates) ? normalizeGates(entry.gates) : {};
    if (!name || paths.length === 0) {
      throw new Error(`${manifestPath}: corpus entries require name and paths`);
    }
    const resolvedPaths = paths.map((path) => resolve(root, path));
    const records = loadRecords(resolvedPaths, false);
    allRecords.push(...records);
    const scores = records.map((record) => scoreIssue(normalizeIssue(record)));
    results.push({
      name,
      paths: resolvedPaths,
      summary: summarize(scores),
      gates,
      failures: gateFailures(scores, gates),
    });
  }

  return { auditFindings: auditCorpus(allRecords), results };
}

function loadRecords(paths: string[], readStdin: boolean): JsonRecord[] {
  const records: JsonRecord[] = [];
  if (readStdin || paths.length === 0) {
    records.push(...readJsonl(readFileSync(0, "utf8"), "<stdin>"));
  }
  for (const path of paths) {
    records.push(...readJsonl(readFileSync(path, "utf8"), path));
  }
  return records;
}

function readJsonl(text: string, source: string): JsonRecord[] {
  const records: JsonRecord[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const record = JSON.parse(trimmed) as JsonRecord;
    if (!isObject(record)) {
      throw new Error(`${source}:${index + 1}: expected JSON object`);
    }
    records.push({ ...record, _source: source });
  }
  return records;
}

function writeAudit(findings: AuditFinding[], format: string): void {
  if (format === "json") {
    console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
    return;
  }
  if (findings.length === 0) {
    console.log("# Issue Corpus Audit\n\nNo corpus audit findings.");
    return;
  }
  console.log([
    "# Issue Corpus Audit",
    "",
    `Found ${findings.length} issue corpus audit finding(s).`,
    "",
    ...findings.map((finding) => `- ${finding.source}: ${finding.identifier}: ${finding.message}`),
  ].join("\n"));
}

function writeCheck(auditFindings: AuditFinding[], results: CorpusCheckResult[], format: string): void {
  if (format === "json") {
    console.log(JSON.stringify({
      ok: auditFindings.length === 0 && results.every((result) => result.failures.length === 0),
      auditFindings,
      corpora: results,
    }, null, 2));
    return;
  }

  const lines = ["# Issue Corpus Check", ""];
  if (auditFindings.length === 0) {
    lines.push("Audit: pass", "");
  } else {
    lines.push(`Audit findings: ${auditFindings.length}`);
    lines.push(...auditFindings.map((finding) => `- ${finding.source}: ${finding.identifier}: ${finding.message}`), "");
  }

  for (const result of results) {
    lines.push(`## ${result.name} - ${result.failures.length > 0 ? "fail" : "pass"}`);
    lines.push(`Scored ${result.summary.count} issues. Average: ${result.summary.average}/100. Range: ${result.summary.minimum}-${result.summary.maximum}.`);
    if (result.failures.length > 0) {
      lines.push("", "Failures:", ...result.failures.map((failure) => `- ${failure}`));
    }
    lines.push("");
  }
  console.log(lines.join("\n").trimEnd());
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const options = new Map<string, string | boolean | string[]>();
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index]!;
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = rest[index + 1];
    const optionValue = !next || next.startsWith("--") ? true : next;
    if (optionValue !== true) index += 1;
    const existing = options.get(key);
    if (existing === undefined) {
      options.set(key, optionValue);
    } else if (Array.isArray(existing)) {
      existing.push(String(optionValue));
    } else {
      options.set(key, [String(existing), String(optionValue)]);
    }
  }
  return { command: command ?? null, positionals, options };
}

function usage(): void {
  console.error("Usage: score_issues.ts <score|collect|audit|check> [options]");
}

function stringOption(args: ParsedArgs, name: string): string | undefined {
  const value = args.options.get(name);
  return typeof value === "string" ? value : undefined;
}

function numberOption(args: ParsedArgs, name: string): number | undefined {
  const value = stringOption(args, name);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`invalid number for --${name}: ${value}`);
  }
  return number;
}

function arrayOption(args: ParsedArgs, name: string): string[] {
  const value = args.options.get(name);
  if (value === undefined || value === true) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function normalizeGates(value: Record<string, unknown>): ScoreGates {
  return {
    minScore: optionalNumber(value.minScore),
    minAverage: optionalNumber(value.minAverage),
    maxScore: optionalNumber(value.maxScore),
    maxAverage: optionalNumber(value.maxAverage),
  };
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

process.exitCode = main(Bun.argv.slice(2));
