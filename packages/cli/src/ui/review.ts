import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { IssuePayload } from "../core/domain.js";

export async function reviewIssueInTerminal(payload: IssuePayload): Promise<boolean> {
  output.write(`\n# ${payload.title}\n\n${payload.body}\n\n`);
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question("Create this GitHub issue? [y/N] ");
    return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}
