import { describe, expect, test } from "bun:test";
import { formatDoctorReport, type DoctorCheck } from "./doctor.js";

describe("doctor report", () => {
  test("summarizes passing checks", () => {
    const checks: DoctorCheck[] = [
      { name: "git", ok: true, detail: "git version 2.47.0" },
      { name: "repository", ok: true, detail: "owner/repo on main." },
    ];

    const report = formatDoctorReport(checks);

    expect(report).toContain("OK git");
    expect(report).toContain("Ready to create issues.");
  });

  test("summarizes failing checks", () => {
    const checks: DoctorCheck[] = [
      { name: "gh", ok: false, detail: "gh was not found on PATH." },
      { name: "repository", ok: true, detail: "owner/repo on main." },
    ];

    const report = formatDoctorReport(checks);

    expect(report).toContain("FAIL gh");
    expect(report).toContain("1 check(s) need attention.");
  });
});
