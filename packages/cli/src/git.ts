import { execa } from "execa";
import type { GitContext } from "./domain.js";

export async function git(args: string[], cwd: string): Promise<string> {
  const result = await execa("git", args, { cwd });
  return result.stdout.trim();
}

export async function getGitContext(cwd: string): Promise<GitContext> {
  const root = await git(["rev-parse", "--show-toplevel"], cwd);
  const branch = await optionalGit(["branch", "--show-current"], root);
  const commit = await optionalGit(["rev-parse", "--short", "HEAD"], root);
  const status = await git(["status", "--porcelain"], root);
  const remoteUrl = await optionalGit(["remote", "get-url", "origin"], root);
  const remote = parseGitHubRemote(remoteUrl);

  return {
    root,
    branch: branch || null,
    commit: commit || null,
    isDirty: status.length > 0,
    remoteOwner: remote?.owner ?? null,
    remoteName: remote?.name ?? null,
  };
}

async function optionalGit(args: string[], cwd: string): Promise<string | null> {
  try {
    return await git(args, cwd);
  } catch {
    return null;
  }
}

export function parseGitHubRemote(remoteUrl: string | null): { owner: string; name: string } | null {
  if (!remoteUrl) {
    return null;
  }

  const normalized = remoteUrl.trim().replace(/\.git$/, "");
  const ssh = normalized.match(/^git@github\.com:(?<owner>[^/]+)\/(?<name>.+)$/);
  if (ssh?.groups) {
    return { owner: ssh.groups.owner, name: ssh.groups.name };
  }

  const https = normalized.match(/^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<name>.+)$/);
  if (https?.groups) {
    return { owner: https.groups.owner, name: https.groups.name };
  }

  return null;
}
