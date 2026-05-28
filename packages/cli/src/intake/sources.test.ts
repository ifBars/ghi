import { describe, expect, test } from "bun:test";
import { collectSourceContexts, extractUrlsFromText } from "./sources.js";

describe("sources", () => {
  test("extracts unique URLs from rough input", () => {
    expect(extractUrlsFromText("see https://example.com/a and https://example.com/a.")).toEqual([
      "https://example.com/a",
    ]);
  });

  test("collects quotes and non-fetched URL placeholders", async () => {
    const sources = await collectSourceContexts({
      urls: ["https://example.com/report"],
      quotes: ["crashes after install"],
      fetchUrls: false,
    });

    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({ kind: "quote", content: "crashes after install" });
    expect(sources[1]).toMatchObject({ kind: "url", source: "https://example.com/report" });
  });
});
