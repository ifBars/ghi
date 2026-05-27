import { mkdir, readFile, writeFile } from "node:fs/promises";
import { closeSync, openSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type GhiJob = {
  id: string;
  status: JobStatus;
  cwd: string;
  report: string;
  args: string[];
  createdAt: string;
  updatedAt: string;
  logPath: string;
  resultUrl?: string;
  error?: string;
};

export type EnqueueJobOptions = {
  cwd: string;
  report: string;
  args: string[];
  nodePath: string;
  cliPath: string;
  onQueued?: (job: GhiJob) => void;
};

export function getJobsDir(): string {
  const base = process.env.LOCALAPPDATA || join(homedir(), ".local", "share");
  return join(base, "ghi", "jobs");
}

export async function enqueueBackgroundJob(options: EnqueueJobOptions): Promise<GhiJob> {
  const id = createJobId();
  const logPath = join(getJobsDir(), `${id}.log`);
  const job: GhiJob = {
    id,
    status: "queued",
    cwd: options.cwd,
    report: options.report,
    args: options.args,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logPath,
  };

  await saveJob(job);
  options.onQueued?.(job);
  await mkdir(dirname(logPath), { recursive: true });
  const out = openSync(logPath, "a");
  const err = openSync(logPath, "a");
  writeSync(out, `ghi job ${id} queued at ${job.createdAt}\n`);
  writeSync(out, `cwd: ${job.cwd}\n\n`);

  if (process.platform === "win32") {
    closeSync(out);
    closeSync(err);
    await launchHiddenWindowsWorker(options.nodePath, options.cliPath, id, options.cwd, logPath);
    return job;
  }

  const child = spawn(options.nodePath, [options.cliPath, "__worker", id], {
    cwd: options.cwd,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true,
    env: process.env,
  });

  child.unref();
  return job;
}

async function launchHiddenWindowsWorker(
  nodePath: string,
  cliPath: string,
  id: string,
  cwd: string,
  logPath: string,
): Promise<void> {
  const errorLogPath = logPath.replace(/\.log$/, ".err.log");
  const launcherPath = join(getJobsDir(), `${id}.ps1`);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$filePath = ${psString(nodePath)}`,
    `$arguments = @(${[cliPath, "__worker", id].map(psString).join(", ")})`,
    `$workingDirectory = ${psString(cwd)}`,
    `$stdout = ${psString(logPath)}`,
    `$stderr = ${psString(errorLogPath)}`,
    "Start-Process -FilePath $filePath -ArgumentList $arguments -WorkingDirectory $workingDirectory -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr",
  ].join("\n");
  await writeFile(launcherPath, script, "utf8");

  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", launcherPath],
    {
      cwd,
      stdio: "ignore",
      windowsHide: true,
    },
  );

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`hidden PowerShell launcher exited with code ${code ?? 1}`));
      }
    });
  });
}

export async function loadJob(id: string): Promise<GhiJob> {
  const raw = await readFile(jobPath(id), "utf8");
  return JSON.parse(raw) as GhiJob;
}

export async function saveJob(job: GhiJob): Promise<void> {
  await mkdir(getJobsDir(), { recursive: true });
  await writeFile(jobPath(job.id), `${JSON.stringify({ ...job, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

export async function listJobs(): Promise<GhiJob[]> {
  await mkdir(getJobsDir(), { recursive: true });
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(getJobsDir());
  const jobs = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => loadJob(entry.slice(0, -".json".length)).catch(() => null)),
  );

  return jobs
    .filter((job): job is GhiJob => job !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function runWorkerJob(id: string, run: (job: GhiJob) => Promise<string | null>): Promise<void> {
  const job = await loadJob(id);
  await saveJob({ ...job, status: "running" });

  try {
    const resultUrl = await run(job);
    await saveJob({ ...job, status: "succeeded", resultUrl: resultUrl ?? undefined });
  } catch (error) {
    await saveJob({
      ...job,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

export async function readJobLog(id: string): Promise<string> {
  const job = await loadJob(id);
  const stderrPath = job.logPath.replace(/\.log$/, ".err.log");
  const stdout = await readFile(job.logPath, "utf8").catch(() => "");
  const stderr = await readFile(stderrPath, "utf8").catch(() => "");
  return [stdout, stderr ? `\n[stderr]\n${stderr}` : ""].join("");
}

export function formatJobList(jobs: GhiJob[]): string {
  if (jobs.length === 0) {
    return "No ghi jobs found.";
  }

  return jobs
    .map((job) => `${job.id}  ${job.status.padEnd(9)}  ${job.createdAt}  ${job.report.slice(0, 80)}`)
    .join("\n");
}

export function formatJobView(job: GhiJob, log: string): string {
  return [
    `Job: ${job.id}`,
    `Status: ${job.status}`,
    `Created: ${job.createdAt}`,
    `Updated: ${job.updatedAt}`,
    `Cwd: ${job.cwd}`,
    job.resultUrl ? `Result: ${job.resultUrl}` : null,
    job.error ? `Error: ${job.error}` : null,
    "",
    "Report:",
    job.report,
    "",
    "Log:",
    log.trim() || "(empty)",
  ].filter((line): line is string => line !== null).join("\n");
}

function jobPath(id: string): string {
  return join(getJobsDir(), `${id}.json`);
}

function createJobId(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${random}`;
}

function psString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
