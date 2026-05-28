import { describe, expect, test } from "bun:test";
import { parseGitHubRemote } from "./git.js";

describe("parseGitHubRemote", () => {
  test("returns null for empty or non-GitHub remotes", () => {
    expect(parseGitHubRemote(null)).toBeNull();
    expect(parseGitHubRemote("git@gitlab.com:ifBars/ghi.git")).toBeNull();
  });

  test("trims whitespace and .git suffix from HTTPS remotes", () => {
    expect(parseGitHubRemote(" https://github.com/ifBars/ghi.git ")).toEqual({
      owner: "ifBars",
      name: "ghi",
    });
  });

  test("preserves nested repository path segments after the owner", () => {
    expect(parseGitHubRemote("git@github.com:ifBars/sandbox/ghi.git")).toEqual({
      owner: "ifBars",
      name: "sandbox/ghi",
    });
  });
});
