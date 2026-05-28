import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GitHubIssue } from "@/lib/github";

const ISSUE_CACHE_PREFIX = "ghi.issues.v1.";

export type CachedIssueRow = GitHubIssue & { repoName: string };

type IssueCache = {
  savedAt: number;
  issues: CachedIssueRow[];
};

const memoryCache = new Map<string, IssueCache>();

export function buildIssueCacheKey(parts: {
  state: string;
  scope: string;
  repo: string;
}): string {
  return `${parts.scope}:${parts.repo || "none"}:${parts.state}`;
}

export async function loadIssueCache(key: string): Promise<CachedIssueRow[] | null> {
  const memory = memoryCache.get(key);
  if (memory) {
    return memory.issues;
  }

  const raw = await AsyncStorage.getItem(`${ISSUE_CACHE_PREFIX}${key}`);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as IssueCache;
    if (!Array.isArray(parsed.issues) || typeof parsed.savedAt !== "number") {
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed.issues;
  } catch {
    return null;
  }
}

export async function saveIssueCache(key: string, issues: CachedIssueRow[]): Promise<void> {
  const cache = { savedAt: Date.now(), issues };
  memoryCache.set(key, cache);
  await AsyncStorage.setItem(`${ISSUE_CACHE_PREFIX}${key}`, JSON.stringify(cache));
}

export async function clearIssueCaches(): Promise<void> {
  memoryCache.clear();
  const keys = await AsyncStorage.getAllKeys();
  const issueKeys = keys.filter((key) => key.startsWith(ISSUE_CACHE_PREFIX));
  if (issueKeys.length > 0) {
    await AsyncStorage.multiRemove(issueKeys);
  }
}
