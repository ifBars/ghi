#!/usr/bin/env node
import { Command } from "commander";
import { formatDoctorReport, runDoctor } from "./doctor.js";
import { runCreateIssueFlow } from "./main.js";

const program = new Command();

program
  .name("ghi")
  .description("Create polished GitHub issues from rough reports using Codex.")
  .version("0.1.0");

program
  .command("doctor")
  .description("Check local git, GitHub CLI, and Codex readiness.")
  .action(async () => {
    const checks = await runDoctor(process.cwd());
    process.stdout.write(`${formatDoctorReport(checks)}\n`);
    if (checks.some((check) => !check.ok)) {
      process.exitCode = 1;
    }
  });

program
  .command("create")
  .description("Create a polished GitHub issue from rough report text.")
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

program
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
