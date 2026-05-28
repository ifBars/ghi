import { Codex } from "@openai/codex-sdk";
import { issuePayloadSchema, type GitContext, type IssuePayload, type IssueTemplate, type SourceContext } from "../core/domain.js";
import { summarizeIssueTemplate } from "../intake/templates.js";

export type IssueGenerationInput = {
  roughInput: string;
  git: GitContext;
  templates: IssueTemplate[];
  sources: SourceContext[];
  exploreSources: boolean;
  screenshots: string[];
  previousDraft?: IssuePayload;
  revisionFeedback?: string[];
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
      networkAccessEnabled: input.exploreSources,
      webSearchMode: input.exploreSources ? "live" : "disabled",
    });

    const prompt = buildIssuePrompt(input);
    const turn = await thread.run(
      input.screenshots.length > 0
        ? [
            { type: "text", text: prompt },
            ...input.screenshots.map((path) => ({ type: "local_image" as const, path })),
          ]
        : prompt,
      {
      outputSchema: issuePayloadJsonSchema,
      },
    );

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
    summary: summarizeIssueTemplate(template),
    content: template.content.slice(0, 8000),
  }));

  return JSON.stringify(
    {
      task: "Transform the rough report into a polished GitHub issue payload.",
      codexRole: [
        "You are the middle layer between rough capture context and the production GitHub issue.",
        "The user is handing you context to steer issue creation; do not treat every note as final issue wording.",
        "Use repository evidence, templates, source snippets, screenshots, and stated uncertainty to produce the maintainer-facing artifact.",
      ],
      hardRequirements: [
        "Do not include the original rough report text verbatim in the issue body.",
        "Do not include a visible AI-generated disclosure.",
        "Use repository issue templates when they apply; if multiple templates are present, choose the best fit from template names, metadata, and prompts.",
        "Map available facts into the selected template's fields and mark unknowns explicitly instead of inventing details.",
        "Prefer precise, maintainer-ready language.",
        "Include missing information as a section in the body when needed.",
        "Return only JSON that matches the provided schema.",
      ],
      roughReport: input.roughInput,
      revision: input.previousDraft
        ? {
            instruction: "Revise the previous draft using the scoring feedback. Return a complete replacement payload, not a patch.",
            previousDraft: input.previousDraft,
            scoringFeedback: input.revisionFeedback ?? [],
          }
        : null,
      git: {
        branch: input.git.branch,
        commit: input.git.commit,
        dirty: input.git.isDirty,
        repository: input.git.remoteOwner && input.git.remoteName
          ? `${input.git.remoteOwner}/${input.git.remoteName}`
          : null,
      },
      templates,
      sources: input.sources.map((source) => ({
        kind: source.kind,
        source: source.source,
        title: source.title,
        status: source.status,
        error: source.error,
        content: source.content.slice(0, 12000),
      })),
      screenshots: input.screenshots.map((path) => ({
        path,
        instruction: "Inspect this screenshot as visual source evidence. Mention visible facts and uncertainty, not raw OCR dumps.",
      })),
      explorationMode: input.exploreSources
        ? {
            enabled: true,
            instructions: [
              "Use supplied URLs and quotes as source evidence for the issue.",
              "When a URL is inaccessible, say what could not be verified and rely on quoted text if present.",
              "If the Codex runtime has browser, Playwright, or web access tools available, inspect the relevant page before finalizing.",
              "Use attached screenshots as primary visual evidence when present.",
              "Capture or request screenshot context when the report is visual, UI-related, or depends on page state.",
              "For external bug report pages such as Nexus Mods, distinguish reporter claim, observed symptoms, affected version/mod, reproduction steps, and maintainer action items.",
            ],
          }
        : {
            enabled: false,
            instructions: [
              "Use only the supplied source snippets, repository context, and rough report.",
              "Do not claim to have inspected external pages unless source content is included.",
            ],
          },
      bodyGuidance: [
        "Include summary, observed behavior, expected behavior, reproduction steps, context, and assumptions when relevant.",
        "Use Markdown headings.",
        "Mention git branch and commit only when relevant to the report.",
        "If external source context is present, include a Source Context or External Report section with verified facts and uncertainty.",
        "If mobile routing context is present, use it to validate the target repository but do not expose routing mechanics unless needed for maintainer action.",
        "If screenshots or uploaded files are attached, include an Evidence section with the visible or documented facts and any uncertainty.",
        "Avoid dumping local file paths into the issue body unless the path itself is actionable for the maintainer.",
      ],
    },
    null,
    2,
  );
}
