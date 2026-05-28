import { z } from "zod";

export const structuredIssueContextSchema = z.object({
  summary: z.string().optional(),
  kind: z.string().optional(),
  observed: z.string().optional(),
  expected: z.string().optional(),
  reproduction: z.array(z.string()).optional(),
  filesTouched: z.array(z.string()).optional(),
  testFailures: z.array(z.string()).optional(),
  evidencePaths: z.array(z.string()).optional(),
  suspectedArea: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  missingInfo: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type StructuredIssueContext = z.infer<typeof structuredIssueContextSchema>;

export function parseStructuredIssueInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = structuredIssueContextSchema.parse(JSON.parse(trimmed));
    return formatStructuredIssueContext(parsed);
  } catch {
    return trimmed;
  }
}

export function formatStructuredIssueContext(input: StructuredIssueContext): string {
  const sections = [
    "# Agent-discovered issue context",
    "",
    "Codex should treat this as structured steering context, inspect the repo as needed, and produce a focused production-ready GitHub issue.",
    input.kind ? `\nKind: ${input.kind}` : "",
    input.summary ? section("Summary", input.summary) : "",
    input.observed ? section("Observed behavior", input.observed) : "",
    input.expected ? section("Expected behavior", input.expected) : "",
    input.reproduction?.length ? listSection("Reproduction", input.reproduction) : "",
    input.filesTouched?.length ? listSection("Files touched or inspected", input.filesTouched) : "",
    input.testFailures?.length ? listSection("Test failures or commands", input.testFailures) : "",
    input.evidencePaths?.length ? listSection("Evidence paths", input.evidencePaths) : "",
    input.suspectedArea ? section("Suspected area", input.suspectedArea) : "",
    typeof input.confidence === "number" ? `\nConfidence: ${input.confidence}` : "",
    input.missingInfo?.length ? listSection("Missing information", input.missingInfo) : "",
    input.notes ? section("Additional notes", input.notes) : "",
  ];

  return sections.filter(Boolean).join("\n").trim();
}

function section(title: string, body: string): string {
  return `\n## ${title}\n${body.trim()}`;
}

function listSection(title: string, values: string[]): string {
  return `\n## ${title}\n${values.map((value) => `- ${value.trim()}`).join("\n")}`;
}
