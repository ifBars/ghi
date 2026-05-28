import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Card, EmptyState, Pill, Screen, useTheme } from "@/components/ui";
import { formatGithubDate, listRepositories, type GitHubRepo } from "@/lib/github";
import { loadRepositoryCache, saveRepositoryCache } from "@/lib/repository-cache";
import { loadGitHubToken, loadSelectedRepo, saveSelectedRepo, type RepoSelectionScope } from "@/lib/session";

export default function ReposScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ returnTo?: string; scope?: string }>();
  const scope: RepoSelectionScope = params.scope === "issues" ? "issues" : "capture";
  const returnTo = params.returnTo === "inbox" ? "/inbox" : params.returnTo === "create" ? "/create" : "/settings";
  const [token, setToken] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (force = false) => {
    const storedToken = await loadGitHubToken();
    setToken(storedToken);
    setSelectedRepo(await loadSelectedRepo(scope));
    if (!storedToken) {
      setRepos([]);
      return;
    }

    if (!force) {
      const cachedRepos = await loadRepositoryCache();
      if (cachedRepos) {
        setRepos(cachedRepos);
        return;
      }
    }

    setLoading(true);
    try {
      const nextRepos = await listRepositories(storedToken);
      setRepos(nextRepos);
      await saveRepositoryCache(nextRepos);
    } catch (error) {
      Alert.alert("Could not load repositories", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handleSelect(repo: GitHubRepo) {
    await saveSelectedRepo(scope, repo.fullName);
    setSelectedRepo(repo.fullName);
    if (process.env.EXPO_OS === "ios") {
      await Haptics.selectionAsync();
    }
    router.navigate(returnTo);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  }

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl tintColor={theme.blue} refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }}
        style={{ backgroundColor: theme.background }}
      >
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text selectable style={{ color: theme.text, fontSize: 38, fontWeight: "900" }}>
              Repositories
            </Text>
            <Text style={{ color: theme.mutedText, fontSize: 24, fontWeight: "900" }}>...</Text>
          </View>
          <Text selectable style={{ color: theme.secondaryText, lineHeight: 20 }}>
            Choose the repository {scope === "issues" ? "Issues should browse." : "Capture should use for new ai-drafts."}
          </Text>
        </View>

        {!token ? (
          <EmptyState title="Connect GitHub first" message="Add a token in Account before browsing repositories." />
        ) : loading ? (
          <Card>
            <ActivityIndicator color={theme.blue} />
            <Text style={{ color: theme.secondaryText, textAlign: "center" }}>Loading repositories...</Text>
          </Card>
        ) : repos.length === 0 ? (
          <EmptyState title="No repositories found" message="The token may need repository access, or this account has no visible repositories." />
        ) : (
          repos.map((repo) => (
            <Pressable
              key={repo.id}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedRepo === repo.fullName }}
              onPress={() => void handleSelect(repo)}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <Card gap={8}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {repo.ownerAvatarUrl ? (
                    <Image
                      source={{ uri: repo.ownerAvatarUrl }}
                      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.elevated }}
                    />
                  ) : (
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.elevated }} />
                  )}
                  <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "900", flex: 1 }}>
                    {repo.fullName}
                  </Text>
                  {selectedRepo === repo.fullName ? <Pill label="selected" active tone="blue" /> : null}
                </View>
                <Text selectable numberOfLines={2} style={{ color: theme.secondaryText, lineHeight: 20 }}>
                  {repo.description || "No description"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Pill label={repo.private ? "private" : "public"} />
                  <Pill label={`${repo.openIssuesCount} open`} />
                  <Pill label={`updated ${formatGithubDate(repo.updatedAt)}`} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
