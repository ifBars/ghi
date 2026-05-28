import { describe, expect, test } from "bun:test";
import { appendHiddenMetadata, buildMetadata, renderHiddenMetadata } from "./metadata.js";
import type { GitContext, IssuePayload } from "./domain.js";

const payload: IssuePayload = {
  title: "Inventory duplicates after reconnect",
  kind: "bug",
  labels: ["bug"],
  body: "## Summary\n\nInventory items duplicate after reconnect.",
  confidence: 0.8,
  missingInformation: [],
  contextSummary: ["git metadata"],
};

const git: GitContext = {
  root: "/repo",
  branch: "main",
  commit: "abc123",
  isDirty: false,
  remoteOwner: "owner",
  remoteName: "repo",
};

describe("metadata", () => {
  test("renders metadata as a hidden comment", () => {
    const rendered = renderHiddenMetadata(buildMetadata(payload, git, "immediate_draft"));
    expect(rendered.startsWith("<!-- ghi:")).toBe(true);
    expect(rendered.endsWith(" -->")).toBe(true);
  });

  test("appends metadata without visible AI disclosure", () => {
    const body = appendHiddenMetadata(payload.body, buildMetadata(payload, git, "immediate_draft"));
    expect(body).toContain("Inventory items duplicate");
    expect(body).toContain("<!-- ghi:");
    expect(body).not.toContain("AI-generated");
    expect(body).not.toContain("rough report");
  });
});
