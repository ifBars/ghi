#!/usr/bin/env node
import { Command } from "commander";
import { runCreateIssueFlow } from "./main.js";

const program = new Command();

program
  .name("ghi")
  .description("Create polished GitHub issues from rough reports using Codex.")
  .argument("[report...]", "rough bug, feature, issue, or idea text")
  .option("--now", "create immediately as an ai-draft issue")
  .option("--review", "review the generated issue in the terminal before creating")
  .option("--dry-run", "generate and print the issue payload without creating a GitHub issue")
  .action(async (reportParts: string[], options: { now?: boolean; review?: boolean; dryRun?: boolean }) => {
    const roughInput = reportParts.join(" ").trim();
    if (!roughInput) {
      program.error("missing rough report text");
    }

    await runCreateIssueFlow(roughInput, {
      cwd: process.cwd(),
      now: options.now,
      review: options.review,
      dryRun: options.dryRun,
    });
  });

await program.parseAsync(process.argv);
