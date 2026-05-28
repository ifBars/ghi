import type { ExistingIssue, IssuePayload, IssueRelationship } from "../core/domain.js";

export function buildDedupeSearchQuery(payload: IssuePayload): string {
  const labelTerms = payload.labels.filter((label) => label !== "ai-draft").slice(0, 3);
  return [payload.title, ...labelTerms].join(" ").trim();
}

export function formatRelationshipComment(relationships: IssueRelationship[]): string | null {
  const visible = relationships
    .filter((relationship) => relationship.confidence >= 0.65)
    .sort((a, b) => b.confidence - a.confidence);

  if (visible.length === 0) {
    return null;
  }

  const lines = ["Possible related or duplicate issues found:", ""];

  for (const relationship of visible) {
    const label = relationship.kind === "duplicate" ? "Possible duplicate of" : "Possibly related to";
    lines.push(
      `- ${label} #${relationship.issue.number}: ${relationship.issue.title} - ${relationship.reason}`,
    );
  }

  return lines.join("\n");
}

export function rankSimpleRelationships(
  createdIssueNumber: number | null,
  candidates: ExistingIssue[],
  payload: IssuePayload,
): IssueRelationship[] {
  const titleTerms = significantTerms(payload.title);

  return candidates
    .filter((candidate) => candidate.number !== createdIssueNumber)
    .map((candidate) => {
      const candidateTerms = significantTerms(candidate.title);
      const overlap = titleTerms.filter((term) => candidateTerms.includes(term));
      const confidence = titleTerms.length === 0 ? 0 : overlap.length / titleTerms.length;
      return {
        issue: candidate,
        kind: confidence >= 0.8 ? "duplicate" as const : "related" as const,
        confidence,
        reason: overlap.length > 0
          ? `overlaps on ${overlap.slice(0, 4).join(", ")}`
          : "similar search result",
      };
    })
    .filter((relationship) => relationship.confidence >= 0.4);
}

function significantTerms(value: string): string[] {
  const stop = new Set(["the", "and", "after", "before", "with", "from", "into", "when"]);
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3 && !stop.has(term));
}
