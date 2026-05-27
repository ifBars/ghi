#!/usr/bin/env node
import { Command } from "commander";
import { writeSync } from "node:fs";
import { formatDoctorReport, runDoctor } from "./doctor.js";
import { enqueueBackgroundJob, formatJobList, formatJobView, listJobs, loadJob, readJobLog, runWorkerJob } from "./jobs.js";
import { extractCreatedIssueUrl, runCreateIssueFlow } from "./main.js";

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
  .command("__worker")
  .description("Internal background worker.")
  .argument("<jobId>")
  .allowUnknownOption(false)
  .action(async (jobId: string) => {
    await runWorkerJob(jobId, async (job) => {
      let output = "";
      await runCreateIssueFlow(job.report, {
        cwd: job.cwd,
        now: job.args.includes("--now"),
        review: false,
        dryRun: job.args.includes("--dry-run"),
        urls: job.urls ?? [],
        quotes: job.quotes ?? [],
        explore: job.explore,
        fetchUrls: job.fetchUrls,
        screenshots: job.screenshots ?? [],
      }, {
        write: (message) => {
          output += message;
          process.stdout.write(message);
        },
      });
      return extractCreatedIssueUrl(output);
    });
  });

program
  .command("jobs")
  .description("List background issue creation jobs.")
  .action(async () => {
    process.stdout.write(`${formatJobList(await listJobs())}\n`);
  });

program
  .command("job")
  .description("View a background issue creation job.")
  .argument("<id>")
  .action(async (id: string) => {
    const job = await loadJob(id);
    const log = await readJobLog(id);
    process.stdout.write(`${formatJobView(job, log)}\n`);
  });

program
  .command("create")
  .description("Create a polished GitHub issue from rough report text.")
  .argument("[report...]", "rough bug, feature, issue, or idea text")
  .option("--now", "create immediately as an ai-draft issue")
  .option("--review", "review the generated issue in the terminal before creating")
  .option("--dry-run", "generate and print the issue payload without creating a GitHub issue")
  .option("--async", "enqueue a background job and return immediately")
  .option("--url <url>", "external source URL to inspect or cite", collectOption)
  .option("--quote <text>", "quoted external report text to use as source context", collectOption)
  .option("--screenshot <path>", "screenshot or image path to attach as visual source evidence", collectOption)
  .option("--explore", "allow deeper source exploration with Codex network/web tools when available")
  .option("--no-fetch", "do not prefetch URL text before handing URLs to Codex")
  .action(async (reportParts: string[], options: CreateCommandOptions) => {
    const roughInput = reportParts.join(" ").trim();
    if (!roughInput) {
      program.error("missing rough report text");
    }

    if (options.async) {
      const job = await enqueueBackgroundJob({
        cwd: process.cwd(),
        report: roughInput,
        args: collectForwardedArgs(options),
        urls: options.url ?? [],
        quotes: options.quote ?? [],
        explore: options.explore,
        fetchUrls: options.fetch,
        screenshots: options.screenshot ?? [],
        nodePath: process.argv[0],
        cliPath: process.argv[1],
        onQueued: (queuedJob) => printQueuedJob(queuedJob.id),
      });
      return;
    }

    await runCreateIssueFlow(roughInput, {
      cwd: process.cwd(),
      now: options.now,
      review: options.review,
      dryRun: options.dryRun,
      urls: options.url ?? [],
      quotes: options.quote ?? [],
      explore: options.explore,
      fetchUrls: options.fetch,
      screenshots: options.screenshot ?? [],
    });
  });

program
  .argument("[report...]", "rough bug, feature, issue, or idea text")
  .option("--now", "create immediately as an ai-draft issue")
  .option("--review", "review the generated issue in the terminal before creating")
  .option("--dry-run", "generate and print the issue payload without creating a GitHub issue")
  .option("--async", "enqueue a background job and return immediately")
  .option("--url <url>", "external source URL to inspect or cite", collectOption)
  .option("--quote <text>", "quoted external report text to use as source context", collectOption)
  .option("--screenshot <path>", "screenshot or image path to attach as visual source evidence", collectOption)
  .option("--explore", "allow deeper source exploration with Codex network/web tools when available")
  .option("--no-fetch", "do not prefetch URL text before handing URLs to Codex")
  .action(async (reportParts: string[], options: CreateCommandOptions) => {
    const roughInput = reportParts.join(" ").trim();
    if (!roughInput) {
      program.error("missing rough report text");
    }

    if (options.async) {
      const job = await enqueueBackgroundJob({
        cwd: process.cwd(),
        report: roughInput,
        args: collectForwardedArgs(options),
        urls: options.url ?? [],
        quotes: options.quote ?? [],
        explore: options.explore,
        fetchUrls: options.fetch,
        screenshots: options.screenshot ?? [],
        nodePath: process.argv[0],
        cliPath: process.argv[1],
        onQueued: (queuedJob) => printQueuedJob(queuedJob.id),
      });
      return;
    }

    await runCreateIssueFlow(roughInput, {
      cwd: process.cwd(),
      now: options.now,
      review: options.review,
      dryRun: options.dryRun,
      urls: options.url ?? [],
      quotes: options.quote ?? [],
      explore: options.explore,
      fetchUrls: options.fetch,
      screenshots: options.screenshot ?? [],
    });
  });

await program.parseAsync(process.argv);

type CreateCommandOptions = {
  now?: boolean;
  review?: boolean;
  dryRun?: boolean;
  async?: boolean;
  url?: string[];
  quote?: string[];
  screenshot?: string[];
  explore?: boolean;
  fetch?: boolean;
};

function collectForwardedArgs(options: { now?: boolean; dryRun?: boolean }): string[] {
  return [
    ...(options.now ? ["--now"] : []),
    ...(options.dryRun ? ["--dry-run"] : []),
  ];
}

function printQueuedJob(id: string): void {
  writeSync(2, `Queued ghi job ${id}\nView: ghi job ${id}\n`);
}

function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}
