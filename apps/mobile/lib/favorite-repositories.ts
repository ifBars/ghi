import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITE_REPOS_KEY = "ghi.favoriteRepos.v1";

export async function loadFavoriteRepoNames(): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(FAVORITE_REPOS_KEY);
  if (raw === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : null;
  } catch {
    return null;
  }
}

export async function saveFavoriteRepoNames(repos: string[]): Promise<void> {
  const uniqueRepos = [...new Set(repos.map((repo) => repo.trim()).filter(Boolean))];
  await AsyncStorage.setItem(FAVORITE_REPOS_KEY, JSON.stringify(uniqueRepos));
}
