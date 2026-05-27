export type IntakeKind = "bug" | "feature" | "idea" | "task";

export type IntakeCapture = {
  kind: IntakeKind;
  repository?: string;
  report: string;
  context?: string;
  createdAt: string;
  source: "cli" | "mobile" | "share";
};

export function formatCliHandoff(capture: IntakeCapture): string {
  const repo = capture.repository ? `# repo: ${capture.repository}\n` : "";
  const context = capture.context?.trim()
    ? `\n\n# context\n${capture.context.trim()}`
    : "";

  return `${repo}ghi --review ${JSON.stringify(capture.report.trim())}${context}`;
}
