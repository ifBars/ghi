import { describe, expect, test } from "bun:test";
import {
  buildDedupeSearchQuery,
  formatRelationshipComment,
  rankSimpleRelationships,
} from "./dedupe.js";
import type { ExistingIssue, IssuePayload } from "./domain.js";

const payload: IssuePayload = {
  title: "Inventory duplicates after reconnect",
  kind: "bug",
  labels: ["ai-draft", "bug", "inventory"],
  body: "## Summary\n\nInventory duplicates after reconnect.",
  confidence: 0.8,
  missingInformation: [],
  contextSummary: [],
};

describe("dedupe", () => {
  test("builds search query without ai-draft label noise", () => {
    expect(buildDedupeSearchQuery(payload)).toBe("Inventory duplicates after reconnect bug inventory");
  });

  test("formats relationship comments above threshold", () => {
    const comment = formatRelationshipComment([
      {
        issue: { number: 4, title: "Inventory duplication on reconnect", state: "OPEN", url: "" },
        kind: "duplicate",
        confidence: 0.9,
        reason: "same subsystem and reconnect trigger",
      },
    ]);

    expect(comment).toContain("Possible duplicate of #4");
  });

  test("suppresses low confidence comments", () => {
    expect(
      formatRelationshipComment([
        {
          issue: { number: 4, title: "Other issue", state: "OPEN", url: "" },
          kind: "related",
          confidence: 0.3,
          reason: "weak match",
        },
      ]),
    ).toBeNull();
  });

  test("ranks simple title overlap relationships", () => {
    const candidates: ExistingIssue[] = [
      { number: 10, title: "Inventory duplicates after reconnecting", state: "OPEN", url: "" },
      { number: 11, title: "Login button color", state: "OPEN", url: "" },
    ];

    const relationships = rankSimpleRelationships(null, candidates, payload);

    expect(relationships[0].issue.number).toBe(10);
    expect(relationships[0].confidence).toBeGreaterThan(0.6);
  });
});
