import type { SourceContext } from "../core/domain.js";

export type SourceCollectionInput = {
  urls: string[];
  quotes: string[];
  fetchUrls: boolean;
};

export async function collectSourceContexts(input: SourceCollectionInput): Promise<SourceContext[]> {
  const sources: SourceContext[] = [];

  for (const quote of input.quotes) {
    const trimmed = quote.trim();
    if (trimmed) {
      sources.push({
        kind: "quote",
        source: "user quote",
        content: trimmed.slice(0, 12000),
      });
    }
  }

  for (const url of input.urls) {
    sources.push(await collectUrlSource(url, input.fetchUrls));
  }

  return sources;
}

export function extractUrlsFromText(value: string): string[] {
  const matches = value.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches.map((match) => match.replace(/[.,;:!?]+$/, "")))];
}

async function collectUrlSource(url: string, fetchUrls: boolean): Promise<SourceContext> {
  if (!fetchUrls) {
    return {
      kind: "url",
      source: url,
      content: "URL supplied for agentic exploration; local prefetch disabled.",
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "ghi/0.1 issue intake",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    const text = contentType.includes("html") ? htmlToText(raw) : raw;

    return {
      kind: "url",
      source: url,
      title: contentType.includes("html") ? extractTitle(raw) : undefined,
      status: response.status,
      content: text.slice(0, 16000),
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      kind: "url",
      source: url,
      content: "URL supplied but local prefetch failed.",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>(?<title>[\s\S]*?)<\/title>/i);
  return match?.groups?.title ? decodeEntities(stripTags(match.groups.title)).trim() : undefined;
}

function htmlToText(html: string): string {
  return decodeEntities(
    stripTags(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, "\n"),
    ),
  )
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
