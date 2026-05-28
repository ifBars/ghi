import { Codex } from "@openai/codex-sdk";
import {
  closurePayloadSchema,
  type ClosurePayload,
  type ClosureStateReason,
  type GitContext,
  type IssueView,
} from "./domain.js";

export type ClosureGenerationInput = {
  issue: IssueView;
  reasonNotes: string[];
  duplicateOf: IssueView | null;
  requestedStateReason: ClosureStateReason | null;
  git: GitContext;
};

export type ClosureGenerator = {
  generate(input: ClosureGenerationInput): Promise<ClosurePayload>;
};

export const closurePayloadJsonSchema = {
  type: "object",
  properties: {
    comment: { type: "string", minLength: 20 },
    stateReason: { type: "string", enum: ["completed", "not planned", "duplicate"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "array", items: { type: "string" } },
    followUps: { type: "array", items: { type: "string" } },
  },
  required: ["comment", "stateReason", "confidence", "summary", "followUps"],
  additionalProperties: false,
} as const;

export class CodexClosureGenerator implements ClosureGenerator {
  async generate(input: ClosureGenerationInput): Promise<ClosurePayload> {
    const codex = new Codex();
    const thread = codex.startThread({
      workingDirectory: input.git.root,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      modelReasoningEffort: "medium",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
    });

    const turn = await thread.run(buildClosurePrompt(input), {
      outputSchema: closurePayloadJsonSchema,
    });

    return parseClosurePayload(turn.finalResponse);
  }
}

export function parseClosurePayload(raw: string): ClosurePayload {
  return closurePayloadSchema.parse(JSON.parse(raw));
}

export function buildClosurePrompt(input: ClosureGenerationInput): string {
  return JSON.stringify(
    {
      task: "Write a proper GitHub issue closure comment and choose the GitHub close reason.",
      hardRequirements: [
        "Return only JSON matching the provided schema.",
        "Do not include a visible AI-generated disclosure.",
        "Do not merely restate the user's terse reason notes; turn them into a maintainer-grade closure.",
        "Make the comment specific to the issue context.",
        "When closing as duplicate, name the duplicate issue and explain why it supersedes this issue.",
        "When context is thin, say what basis is being used and keep the closure modest.",
      ],
      requestedStateReason: input.requestedStateReason,
      reasonNotes: input.reasonNotes,
      git: {
        branch: input.git.branch,
        commit: input.git.commit,
        dirty: input.git.isDirty,
        repository: input.git.remoteOwner && input.git.remoteName
          ? `${input.git.remoteOwner}/${input.git.remoteName}`
          : null,
      },
      issue: serializeIssue(input.issue),
      duplicateOf: input.duplicateOf ? serializeIssue(input.duplicateOf) : null,
      commentGuidance: [
        "Use concise Markdown.",
        "Cover the closure decision, evidence or rationale, duplicate relationship when applicable, and any remaining follow-up.",
        "Prefer a direct final sentence such as 'Closing this as completed.' or 'Closing this as a duplicate of #123.'",
      ],
    },
    null,
    2,
  );
}

function serializeIssue(issue: IssueView): object {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    stateReason: issue.stateReason ?? null,
    url: issue.url,
    labels: issue.labels?.map((label) => label.name) ?? [],
    body: issue.body?.slice(0, 12000) ?? "",
    comments: issue.comments?.slice(-8).map((comment) => ({
      author: comment.author?.login,
      createdAt: comment.createdAt,
      body: comment.body?.slice(0, 4000) ?? "",
    })) ?? [],
  };
}
