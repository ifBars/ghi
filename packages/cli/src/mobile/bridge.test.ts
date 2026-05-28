import { describe, expect, test } from "bun:test";
import {
  extensionForMime,
  formatBridgeError,
  normalizeRepo,
  sanitizeFileName,
  stripDataUrlPrefix,
} from "./bridge.js";

describe("mobile bridge helpers", () => {
  test("normalizes repo identifiers for desktop/mobile comparison", () => {
    expect(normalizeRepo(" IfBars/GHI.git ")).toBe("ifbars/ghi");
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

  test("formats bridge errors without leaking command output noise", () => {
    expect(formatBridgeError(new Error("gh issue create failed\nsecret-ish details"))).toBe(
      "Desktop issue creation failed. Check `ghi jobs` on the desktop for the full error.",
    );
    expect(formatBridgeError(new Error("plain failure\nstack line"))).toBe("plain failure");
  });
});
