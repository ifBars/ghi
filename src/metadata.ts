import type { GitContext, IssuePayload } from "./domain.js";

export type GhiMetadata = {
  version: 1;
  mode: string;
  labels: string[];
  context: string[];
  branch: string | null;
  commit: string | null;
  dirty: boolean;
};

export function buildMetadata(payload: IssuePayload, git: GitContext, mode: string): GhiMetadata {
  return {
    version: 1,
    mode,
    labels: payload.labels,
    context: payload.contextSummary,
    branch: git.branch,
    commit: git.commit,
    dirty: git.isDirty,
  };
}

export function renderHiddenMetadata(metadata: GhiMetadata): string {
  const encoded = Buffer.from(JSON.stringify(metadata), "utf8").toString("base64url");
  return `<!-- ghi:${encoded} -->`;
}

export function appendHiddenMetadata(body: string, metadata: GhiMetadata): string {
  return `${body.trim()}\n\n${renderHiddenMetadata(metadata)}\n`;
}
