import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GitHubRepo } from "@/lib/github";

const REPOSITORY_CACHE_KEY = "ghi.repositories.v1";
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

type RepositoryCache = {
  savedAt: number;
  repos: GitHubRepo[];
};

let memoryCache: RepositoryCache | null = null;

export async function loadRepositoryCache(maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<GitHubRepo[] | null> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.savedAt <= maxAgeMs) {
    return memoryCache.repos;
  }

  const raw = await AsyncStorage.getItem(REPOSITORY_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as RepositoryCache;
    if (
      !Array.isArray(parsed.repos) ||
      typeof parsed.savedAt !== "number" ||
      parsed.repos.some((repo) => !repo.ownerAvatarUrl)
    ) {
      return null;
    }

    memoryCache = parsed;
    if (now - parsed.savedAt > maxAgeMs) {
      return null;
    }
    return parsed.repos;
  } catch {
    return null;
  }
}

export async function saveRepositoryCache(repos: GitHubRepo[]): Promise<void> {
  memoryCache = { savedAt: Date.now(), repos };
  await AsyncStorage.setItem(REPOSITORY_CACHE_KEY, JSON.stringify(memoryCache));
}

export async function clearRepositoryCache(): Promise<void> {
  memoryCache = null;
  await AsyncStorage.removeItem(REPOSITORY_CACHE_KEY);
}
