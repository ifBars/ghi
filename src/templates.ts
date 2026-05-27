import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { IssueTemplate } from "./domain.js";

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
