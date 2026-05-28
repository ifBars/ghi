import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildMobileRoughInput,
  buildRepoMismatchError,
  extensionForMime,
  formatBridgeError,
  formatMobileEvidenceSummary,
  loadOrCreatePersistedToken,
  normalizeRepo,
  persistedTokenPath,
  sanitizeFileName,
  stripDataUrlPrefix,
} from "./bridge.js";

describe("mobile bridge helpers", () => {
  test("normalizes repo identifiers for desktop/mobile comparison", () => {
    expect(normalizeRepo(" IfBars/GHI.git ")).toBe("ifbars/ghi");
  });

  test("persists one pairing token per repo root", async () => {
    const localAppData = await mkdtemp(join(tmpdir(), "ghi-localappdata-"));
    const previousLocalAppData = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = localAppData;

    try {
      const repoRoot = "C:/Users/ghost/Desktop/Coding/ghi";
      const first = await loadOrCreatePersistedToken(repoRoot);
      const second = await loadOrCreatePersistedToken(repoRoot);

      expect(first).toBe(second);
      expect(first.length).toBeGreaterThan(20);
      await expect(readFile(persistedTokenPath(repoRoot), "utf8")).resolves.toContain(first);
    } finally {
      if (previousLocalAppData === undefined) {
        delete process.env.LOCALAPPDATA;
      } else {
        process.env.LOCALAPPDATA = previousLocalAppData;
      }
    }
  });

  test("explains repo mismatch recovery without guessing another checkout", () => {
    expect(buildRepoMismatchError("ifBars/ghi", "ifBars/other")).toContain(
      "Start `ghi mobile serve` from the selected repo checkout",
    );
  });

  test("builds mobile rough input as steering context for Codex", () => {
    const roughInput = buildMobileRoughInput({
      kind: "bug",
      report: "capture send fails",
      repo: "ifBars/ghi",
      selectedRepo: "ifBars/ghi",
      context: "Screenshot attached",
      evidenceSummary: "- capture.png (image, image/png)",
    });

    expect(roughInput).toContain("[bug] capture send fails");
    expect(roughInput).toContain("Mobile routing:");
    expect(roughInput).toContain("Codex should use this as routing context only");
    expect(roughInput).toContain("Mobile evidence:");
    expect(roughInput).toContain("Use these uploaded files as source evidence");
  });

  test("sanitizes unsafe upload filenames without dropping the useful name", () => {
    expect(sanitizeFileName(' crash:<shot>|?.png  ')).toBe("crash--shot---.png");
  });

  test("strips data URL prefixes before base64 decoding", () => {
    expect(stripDataUrlPrefix("data:image/png;base64,aGVsbG8=")).toBe("aGVsbG8=");
    expect(stripDataUrlPrefix("aGVsbG8=")).toBe("aGVsbG8=");
  });

  test("maps common mime types to stable file extensions", () => {
    expect(extensionForMime()).toBe(".bin");
    expect(extensionForMime("image/jpeg")).toBe(".jpg");
    expect(extensionForMime("text/plain")).toBe(".txt");
    expect(extensionForMime("application/vnd.api+json")).toBe(".vnd.api");
  });

  test("formats mobile evidence as compact source handles", () => {
    const summary = formatMobileEvidenceSummary({
      filename: "capture.png",
      kind: "image",
      mimeType: "image/png",
      size: 42,
      filePath: "C:/uploads/capture.png",
    });

    expect(summary).toContain("capture.png (image, image/png, 42 bytes)");
    expect(summary).toContain("local: C:/uploads/capture.png");
    expect(summary).not.toContain("Use as source context");
  });

  test("formats bridge errors without leaking command output noise", () => {
    expect(formatBridgeError(new Error("gh issue create failed\nsecret-ish details"))).toBe(
      "Desktop issue creation failed. Check `ghi jobs` on the desktop for the full error.",
    );
    expect(formatBridgeError(new Error("plain failure\nstack line"))).toBe("plain failure");
  });
});
