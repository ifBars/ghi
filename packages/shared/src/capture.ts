export type IntakeKind = "bug" | "feature" | "idea" | "task";

export type IntakeCapture = {
  kind: IntakeKind;
  repository?: string;
  report: string;
  context?: string;
  createdAt: string;
  source: "cli" | "mobile" | "share";
};

