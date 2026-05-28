#!/usr/bin/env node
import { Command } from "commander";
import { writeSync } from "node:fs";
import { enqueueBackgroundJob, formatJobList, formatJobView, listJobs, loadJob, readJobLog, runWorkerJob } from "./background/jobs.js";
import { runCloseIssueFlow } from "./commands/close.js";
import { extractCreatedIssueUrl, runCreateIssueFlow } from "./commands/create.js";
import { formatDoctorReport, runDoctor } from "./commands/doctor.js";
import { startMobileBridge } from "./mobile/bridge.js";

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
  .command("close")
  .description("Close a GitHub issue with a Codex-generated closure comment.")
  .argument("<issue>", "issue number or URL to close")
  .argument("[reason...]", "short low-context closure reason notes")
  .option("--duplicate-of <issue>", "mark as duplicate of another issue number or URL")
  .option("--state-reason <reason>", "GitHub close reason: completed, not-planned, or duplicate")
  .option("--review", "review the generated closure comment before closing")
  .option("--dry-run", "generate and print the closure payload without closing the issue")
  .action(async (issue: string, reasonParts: string[], options: CloseCommandOptions) => {
    await runCloseIssueFlow({
      cwd: process.cwd(),
      issue,
      reasonNotes: reasonParts,
      duplicateOf: options.duplicateOf,
      stateReason: options.stateReason,
      review: options.review,
      dryRun: options.dryRun,
    });
  });

const mobile = program
  .command("mobile")
  .description("Pair and serve local desktop CLI workflows to the mobile app.");

mobile
  .command("serve")
  .description("Start a token-protected local bridge for mobile captures.")
  .option("--host <host>", "host/IP to bind and advertise")
  .option("--port <port>", "port to listen on", parsePort)
  .option("--token <token>", "pairing token to require instead of generating one")
  .action(async (options: MobileServeOptions) => {
    await startMobileBridge({
      cwd: process.cwd(),
      host: options.host,
      port: options.port,
      token: options.token,
    });
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

type CloseCommandOptions = {
  duplicateOf?: string;
  stateReason?: string;
  review?: boolean;
  dryRun?: boolean;
};

type MobileServeOptions = {
  host?: string;
  port?: number;
  token?: string;
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

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`invalid port: ${value}`);
  }
  return port;
}
