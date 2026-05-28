import { describe, expect, test } from "bun:test";
import { loadConfig, resolveCreationMode } from "./config.js";

describe("config", () => {
  test("defaults to immediate draft", () => {
    expect(loadConfig().creationMode).toBe("immediate_draft");
  });

  test("accepts terminal review override", () => {
    expect(resolveCreationMode({ creationMode: "terminal_review" })).toBe("terminal_review");
  });

  test("rejects unknown creation mode", () => {
    expect(() => resolveCreationMode({ creationMode: "surprise" })).toThrow();
  });
});
