import { z } from "zod";

export const creationModeSchema = z.enum([
  "immediate_draft",
  "terminal_review",
  "editor_review",
  "github_prefill",
]);

export type CreationMode = z.infer<typeof creationModeSchema>;

export const issueKindSchema = z.enum([
  "bug",
  "feature",
  "idea",
  "task",
  "question",
  "unknown",
]);

export type IssueKind = z.infer<typeof issueKindSchema>;

export const issuePayloadSchema = z.object({
  title: z.string().min(8).max(180),
  kind: issueKindSchema.default("unknown"),
  labels: z.array(z.string().min(1)).default([]),
  body: z.string().min(20),
  confidence: z.number().min(0).max(1).default(0.5),
  missingInformation: z.array(z.string()).default([]),
  contextSummary: z.array(z.string()).default([]),
});

export type IssuePayload = z.infer<typeof issuePayloadSchema>;

export type GitContext = {
  root: string;
  branch: string | null;
  commit: string | null;
  isDirty: boolean;
  remoteOwner: string | null;
  remoteName: string | null;
};

export type IssueTemplate = {
  name: string;
  path: string;
  content: string;
};

export type SourceContext = {
  kind: "url" | "quote";
  source: string;
  title?: string;
  status?: number;
  content: string;
  error?: string;
};

export type GhiConfig = {
  creationMode: CreationMode;
  aiDraftLabel: string;
  triageLabelCandidates: string[];
};

export type CreatedIssue = {
  number: number | null;
  url: string;
};

export type ExistingIssue = {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED" | string;
  url: string;
  body?: string;
};

export const closureStateReasonSchema = z.enum(["completed", "not planned", "duplicate"]);

export type ClosureStateReason = z.infer<typeof closureStateReasonSchema>;

export const closurePayloadSchema = z.object({
  comment: z.string().min(20),
  stateReason: closureStateReasonSchema,
  confidence: z.number().min(0).max(1).default(0.5),
  summary: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
});

export type ClosurePayload = z.infer<typeof closurePayloadSchema>;

export type IssueView = ExistingIssue & {
  labels?: Array<{ name: string }>;
  comments?: Array<{ author?: { login?: string }; body?: string; createdAt?: string }>;
  stateReason?: string | null;
};

export type RelationshipKind = "duplicate" | "related";

export type IssueRelationship = {
  issue: ExistingIssue;
  kind: RelationshipKind;
  confidence: number;
  reason: string;
};

export type CreateIssueOptions = {
  title: string;
  body: string;
  labels: string[];
};
