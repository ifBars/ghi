import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { IssuePayload } from "../core/domain.js";

export async function askClarificationQuestions(questions: string[]): Promise<string[]> {
  if (questions.length === 0) {
    return [];
  }

  output.write("\nTo improve this draft, answer any of these follow-up questions (or press Enter to skip):\n");
  const rl = createInterface({ input, output });
  const responses: string[] = [];
  try {
    for (const question of questions) {
      const answer = await rl.question(`\n${question}\n> `);
      const trimmed = answer.trim();
      if (trimmed) {
        responses.push(`Q: ${question}\nA: ${trimmed}`);
      }
    }
  } finally {
    rl.close();
  }

  return responses;
}

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
