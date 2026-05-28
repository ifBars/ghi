import { describe, expect, test } from "bun:test";
import { formatJobList, formatJobListJson, formatJobView, formatJobViewJson, formatQueuedJobJson, type GhiJob } from "./jobs.js";

const job: GhiJob = {
  id: "20260527120000-abc123",
  status: "succeeded",
  cwd: "/repo",
  report: "Make mobile UX better",
  args: ["--now"],
  urls: [],
  quotes: [],
  screenshots: [],
  createdAt: "2026-05-27T12:00:00.000Z",
  updatedAt: "2026-05-27T12:01:00.000Z",
  logPath: "/tmp/job.log",
  resultUrl: "https://github.com/o/r/issues/1",
};

describe("jobs formatting", () => {
  test("formats empty job list", () => {
    expect(formatJobList([])).toBe("No ghi jobs found.");
  });

  test("formats job list", () => {
    expect(formatJobList([job])).toContain("20260527120000-abc123  succeeded");
  });

  test("formats job detail with log", () => {
    const formatted = formatJobView(job, "Created issue: https://github.com/o/r/issues/1");

    expect(formatted).toContain("Status: succeeded");
    expect(formatted).toContain("Result: https://github.com/o/r/issues/1");
    expect(formatted).toContain("Make mobile UX better");
  });

  test("formats machine-readable job output", () => {
    expect(JSON.parse(formatJobListJson([job])).jobs[0]).toMatchObject({
      id: job.id,
      status: "succeeded",
      resultUrl: job.resultUrl,
    });
    expect(JSON.parse(formatJobViewJson(job, "log text")).log).toBe("log text");
    expect(JSON.parse(formatQueuedJobJson(job)).job.id).toBe(job.id);
  });
});
