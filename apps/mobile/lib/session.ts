import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "ghi.githubToken.v1";
const SELECTED_REPO_KEYS = {
  capture: "ghi.capture.selectedRepo.v1",
  issues: "ghi.issues.selectedRepo.v1",
} as const;

export type RepoSelectionScope = keyof typeof SELECTED_REPO_KEYS;

export async function loadGitHubToken(): Promise<string | null> {
  if (process.env.EXPO_OS === "web") {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveGitHubToken(token: string): Promise<void> {
  const normalized = token.trim();
  if (process.env.EXPO_OS === "web") {
    await AsyncStorage.setItem(TOKEN_KEY, normalized);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, normalized);
}

export async function clearGitHubToken(): Promise<void> {
  if (process.env.EXPO_OS === "web") {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function loadSelectedRepo(scope: RepoSelectionScope): Promise<string> {
  return (await AsyncStorage.getItem(SELECTED_REPO_KEYS[scope])) ?? "";
}

export async function saveSelectedRepo(scope: RepoSelectionScope, repo: string): Promise<void> {
  await AsyncStorage.setItem(SELECTED_REPO_KEYS[scope], repo);
}
