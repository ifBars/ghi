import { describe, expect, test } from "bun:test";
import { normalizeIssue, scoreIssue } from "../intake/scoring.js";
import { buildGuidanceComment, labelsForScore, scoreBucket, scoreToTen, shouldComment } from "./scoreIssue.js";

describe("score issue action helpers", () => {
  test("converts raw score to one-decimal action score", () => {
    expect(scoreToTen(67)).toBe("6.7");
    expect(scoreToTen(95)).toBe("9.5");
  });

  test("groups score labels by one-point buckets", () => {
    expect(scoreBucket("6.7")).toBe("6.x");
    expect(scoreBucket("10.0")).toBe("10.0");
    expect(scoreBucket("-1")).toBe("0.x");
  });

  test("builds prefixed score and grade labels", () => {
    expect(labelsForScore("7.2", "usable", "ghi-score/", "ghi-quality/")).toEqual([
      "ghi-score/7.x",
      "ghi-quality/usable",
    ]);
  });

  test("skips maintainer-authored low-score comments by default", () => {
    expect(shouldComment(4.2, 6.6, "OWNER", true)).toBe(false);
    expect(shouldComment(4.2, 6.6, "NONE", true)).toBe(true);
    expect(shouldComment(7.1, 6.6, "NONE", true)).toBe(false);
  });

  test("guidance comment includes marker, score, and weak dimensions", () => {
    const score = scoreIssue(normalizeIssue({
      repo: "example/project",
      number: 1,
      title: "it crashes",
      labels: [{ name: "bug" }],
      body: "how do i fix it",
      url: "https://github.com/example/project/issues/1",
    }));

    const comment = buildGuidanceComment(score, scoreToTen(score.total), 6.6);

    expect(comment).toContain("<!-- ghi-score-guidance -->");
    expect(comment).toContain("/10.0");
    expect(comment).toContain("Expected, observed, and repro");
  });
});
