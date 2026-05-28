import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { IssueTemplate } from "../core/domain.js";

const TEMPLATE_EXTENSIONS = new Set([".md", ".yml", ".yaml"]);

export async function discoverIssueTemplates(repoRoot: string): Promise<IssueTemplate[]> {
  const root = resolve(repoRoot);
  const templateRoot = join(root, ".github", "ISSUE_TEMPLATE");

  try {
    const templateStat = await stat(templateRoot);
    if (!templateStat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const entries = await readdir(templateRoot, { withFileTypes: true });
  const templates: IssueTemplate[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const absolute = resolve(templateRoot, entry.name);
    if (!absolute.startsWith(root)) {
      continue;
    }

    const extension = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
    if (!TEMPLATE_EXTENSIONS.has(extension)) {
      continue;
    }

    templates.push({
      name: entry.name,
      path: relative(root, absolute),
      content: await readFile(absolute, "utf8"),
    });
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export function summarizeIssueTemplate(template: IssueTemplate): {
  name: string;
  path: string;
  title: string | null;
  description: string | null;
  labels: string[];
  prompts: string[];
} {
  const metadata = parseYamlishTemplateMetadata(template.content);
  return {
    name: template.name,
    path: template.path,
    title: metadata.name ?? firstMarkdownHeading(template.content),
    description: metadata.description ?? null,
    labels: metadata.labels,
    prompts: extractTemplatePrompts(template.content).slice(0, 12),
  };
}

function firstMarkdownHeading(content: string): string | null {
  const match = content.match(/^#\s+(?<heading>.+)$/m);
  return match?.groups?.heading.trim() ?? null;
}

function parseYamlishTemplateMetadata(content: string): {
  name: string | null;
  description: string | null;
  labels: string[];
} {
  const lines = content.split(/\r?\n/);
  const metadata: Record<string, string> = {};

  for (const line of lines.slice(0, 80)) {
    const match = line.match(/^(?<key>name|description|title|labels):\s*(?<value>.+)$/i);
    if (!match?.groups) {
      continue;
    }
    metadata[match.groups.key.toLowerCase()] = match.groups.value.trim().replace(/^["']|["']$/g, "");
  }

  return {
    name: metadata.name ?? metadata.title ?? null,
    description: metadata.description ?? null,
    labels: metadata.labels
      ? metadata.labels.split(",").map((label) => label.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      : [],
  };
}

function extractTemplatePrompts(content: string): string[] {
  const prompts: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:#{2,6}|\*\*|-\s+|label:|description:)\s*(?<prompt>.+?)\*?$/i);
    const prompt = match?.groups?.prompt?.trim();
    if (prompt && prompt.length >= 4 && !prompt.startsWith("<!--")) {
      prompts.push(prompt.slice(0, 180));
    }
  }
  return [...new Set(prompts)];
}
