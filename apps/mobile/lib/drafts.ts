import AsyncStorage from "@react-native-async-storage/async-storage";

export type IntakeKind = "bug" | "feature" | "idea" | "task";

export type MobileDraft = {
  id: string;
  kind: IntakeKind;
  repository: string;
  report: string;
  context: string;
  title: string;
  body: string;
  createdAt: string;
};

const STORAGE_KEY = "ghi.mobileDrafts.v1";

export function createIssuePreview(input: {
  kind: IntakeKind;
  repository: string;
  report: string;
  context: string;
}): Pick<MobileDraft, "title" | "body"> {
  const normalized = input.report.trim().replace(/\s+/g, " ");
  const title = titleCase(normalized.length > 84 ? `${normalized.slice(0, 81)}...` : normalized);
  const context = input.context.trim();

  return {
    title,
    body: [
      "## Summary",
      normalized || "Captured issue needs a summary.",
      "",
      "## Type",
      input.kind,
      "",
      "## Mobile Capture Context",
      context || "No additional context captured.",
      "",
      "## Next Step",
      "Run this through `ghi` from the target repository to generate the final repo-aware issue.",
    ].join("\n"),
  };
}

export async function loadDrafts(): Promise<MobileDraft[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as MobileDraft[];
  return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveDraft(draft: MobileDraft): Promise<void> {
  const drafts = await loadDrafts();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([draft, ...drafts]));
}

export async function deleteDraft(id: string): Promise<void> {
  const drafts = await loadDrafts();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.filter((draft) => draft.id !== id)));
}

export function formatHandoff(draft: MobileDraft): string {
  const repoHint = draft.repository.trim() ? `# repo: ${draft.repository.trim()}\n` : "";
  return `${repoHint}ghi --review ${JSON.stringify(draft.report.trim())}\n\n${draft.body}`;
}

function titleCase(value: string): string {
  if (!value) {
    return "Captured issue";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
