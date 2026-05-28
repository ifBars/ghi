import { execa } from "execa";
import { getGitContext } from "../integrations/git.js";

export type DoctorCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export async function runDoctor(cwd: string): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  checks.push(await checkCommand("git", ["--version"], cwd, "Git is available."));
  checks.push(await checkCommand("gh", ["--version"], cwd, "GitHub CLI is available."));
  checks.push(await checkCommand("bun", ["pm", "ls", "@openai/codex-sdk"], cwd, "Codex SDK is installed."));
  checks.push(await checkGhAuth(cwd));
  checks.push(await checkRepository(cwd));

  return checks;
}

export function formatDoctorReport(checks: DoctorCheck[]): string {
  const lines = ["ghi doctor", ""];
  for (const check of checks) {
    lines.push(`${check.ok ? "OK" : "FAIL"} ${check.name}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok).length;
  lines.push("");
  lines.push(failed === 0 ? "Ready to create issues." : `${failed} check(s) need attention.`);
  return lines.join("\n");
}

async function checkCommand(
  command: string,
  args: string[],
  cwd: string,
  successDetail: string,
): Promise<DoctorCheck> {
  try {
    const result = await execa(command, args, { cwd });
    return {
      name: command === "bun" ? "codex sdk" : command,
      ok: true,
      detail: result.stdout.split(/\r?\n/)[0] || successDetail,
    };
  } catch {
    return {
      name: command === "bun" ? "codex sdk" : command,
      ok: false,
      detail: command === "bun"
        ? "Could not verify @openai/codex-sdk installation."
        : `${command} was not found on PATH.`,
    };
  }
}

async function checkGhAuth(cwd: string): Promise<DoctorCheck> {
  try {
    await execa("gh", ["auth", "status", "-h", "github.com"], { cwd });
    return {
      name: "github auth",
      ok: true,
      detail: "GitHub CLI is authenticated for github.com.",
    };
  } catch {
    return {
      name: "github auth",
      ok: false,
      detail: "Run `gh auth login` before creating issues.",
    };
  }
}

async function checkRepository(cwd: string): Promise<DoctorCheck> {
  try {
    const git = await getGitContext(cwd);
    if (!git.remoteOwner || !git.remoteName) {
      return {
        name: "repository",
        ok: false,
        detail: "Current git repo does not have a GitHub origin remote.",
      };
    }

    return {
      name: "repository",
      ok: true,
      detail: `${git.remoteOwner}/${git.remoteName} on ${git.branch ?? "detached HEAD"}.`,
    };
  } catch {
    return {
      name: "repository",
      ok: false,
      detail: "Run ghi from inside a git repository.",
    };
  }
}
