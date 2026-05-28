import type { IntakeCapture } from "./capture.js";

export function formatCliHandoff(capture: IntakeCapture): string {
  const repo = capture.repository ? `# repo: ${capture.repository}\n` : "";
  const context = capture.context?.trim()
    ? `\n\n# context\n${capture.context.trim()}`
    : "";

  return `${repo}ghi --review ${JSON.stringify(capture.report.trim())}${context}`;
}

