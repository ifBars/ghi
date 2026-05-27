import { Codex } from "@openai/codex-sdk";
import { issuePayloadSchema, type GitContext, type IssuePayload, type IssueTemplate } from "./domain.js";

export type IssueGenerationInput = {
  roughInput: string;
  git: GitContext;
  templates: IssueTemplate[];
};

export type IssueGenerator = {
  generate(input: IssueGenerationInput): Promise<IssuePayload>;
};

export const issuePayloadJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 8, maxLength: 180 },
    kind: { type: "string", enum: ["bug", "feature", "idea", "task", "question", "unknown"] },
    labels: { type: "array", items: { type: "string" } },
    body: { type: "string", minLength: 20 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    missingInformation: { type: "array", items: { type: "string" } },
    contextSummary: { type: "array", items: { type: "string" } },
  },
  required: ["title", "kind", "labels", "body", "confidence", "missingInformation", "contextSummary"],
  additionalProperties: false,
} as const;

export class CodexIssueGenerator implements IssueGenerator {
  async generate(input: IssueGenerationInput): Promise<IssuePayload> {
    const codex = new Codex();
    const thread = codex.startThread({
      workingDirectory: input.git.root,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      modelReasoningEffort: "medium",
    });

    const turn = await thread.run(buildIssuePrompt(input), {
      outputSchema: issuePayloadJsonSchema,
    });

    return parseIssuePayload(turn.finalResponse);
  }
}

export function parseIssuePayload(raw: string): IssuePayload {
  return issuePayloadSchema.parse(JSON.parse(raw));
}

export function buildIssuePrompt(input: IssueGenerationInput): string {
  const templates = input.templates.map((template) => ({
    name: template.name,
    path: template.path,
    content: template.content.slice(0, 8000),
  }));

  return JSON.stringify(
    {
      task: "Transform the rough report into a polished GitHub issue payload.",
      hardRequirements: [
        "Do not include the original rough report text verbatim in the issue body.",
        "Do not include a visible AI-generated disclosure.",
        "Use repository issue templates when they apply.",
        "Prefer precise, maintainer-ready language.",
        "Include missing information as a section in the body when needed.",
        "Return only JSON that matches the provided schema.",
      ],
      roughReport: input.roughInput,
      git: {
        branch: input.git.branch,
        commit: input.git.commit,
        dirty: input.git.isDirty,
        repository: input.git.remoteOwner && input.git.remoteName
          ? `${input.git.remoteOwner}/${input.git.remoteName}`
          : null,
      },
      templates,
      bodyGuidance: [
        "Include summary, observed behavior, expected behavior, reproduction steps, context, and assumptions when relevant.",
        "Use Markdown headings.",
        "Mention git branch and commit only when relevant to the report.",
      ],
    },
    null,
    2,
  );
}
