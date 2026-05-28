import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, Pill, Screen, useTheme } from "@/components/ui";
import { listRepositories, getViewer, type GitHubRepo, type GitHubUser } from "@/lib/github";
import { loadDrafts } from "@/lib/drafts";
import { loadFavoriteRepoNames, saveFavoriteRepoNames } from "@/lib/favorite-repositories";
import { loadRepositoryCache, saveRepositoryCache } from "@/lib/repository-cache";
import { loadGitHubToken } from "@/lib/session";

type WorkItem = {
  title: string;
  subtitle: string;
  color: string;
  target: string;
};

const workItems: WorkItem[] = [
  { title: "Issues", subtitle: "Track triage across repos", color: "#3fb950", target: "/inbox" },
  { title: "Capture", subtitle: "Create ai-draft issues fast", color: "#58a6ff", target: "/create" },
  { title: "Drafts", subtitle: "CLI handoffs saved on device", color: "#a371f7", target: "/drafts" },
  { title: "Settings", subtitle: "GitHub and desktop connection", color: "#f0883e", target: "/settings" },
];

export default function HomeScreen() {
  const theme = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [allRepos, setAllRepos] = useState<GitHubRepo[]>([]);
  const [favoriteRepoNames, setFavoriteRepoNames] = useState<string[] | null>(null);
  const [draftFavoriteRepoNames, setDraftFavoriteRepoNames] = useState<string[]>([]);
  const [editingFavorites, setEditingFavorites] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const storedToken = await loadGitHubToken();
    setToken(storedToken);
    setDraftCount((await loadDrafts()).length);

    if (!storedToken) {
      setViewer(null);
      setRepos([]);
      setAllRepos([]);
      return;
    }

    const cachedRepos = await loadRepositoryCache();
    const savedFavoriteNames = await loadFavoriteRepoNames();
    setFavoriteRepoNames(savedFavoriteNames);
    if (cachedRepos) {
      setAllRepos(cachedRepos);
      setRepos(resolveFavoriteRepos(cachedRepos, savedFavoriteNames));
    }

    setLoading(!cachedRepos);
    try {
      const user = await getViewer(storedToken);
      setViewer(user);
      if (!cachedRepos) {
        const repoList = await listRepositories(storedToken);
        setAllRepos(repoList);
        setRepos(resolveFavoriteRepos(repoList, savedFavoriteNames));
        await saveRepositoryCache(repoList);
      }
    } catch {
      setViewer(null);
      if (!cachedRepos) {
        setRepos([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  function openFavoritesEditor() {
    setDraftFavoriteRepoNames(favoriteRepoNames ?? repos.map((repo) => repo.fullName));
    setEditingFavorites(true);
  }

  async function saveFavorites() {
    await saveFavoriteRepoNames(draftFavoriteRepoNames);
    setFavoriteRepoNames(draftFavoriteRepoNames);
    setRepos(resolveFavoriteRepos(allRepos, draftFavoriteRepoNames));
    setEditingFavorites(false);
  }

  function toggleFavoriteRepo(repoName: string) {
    setDraftFavoriteRepoNames((current) =>
      current.includes(repoName)
        ? current.filter((name) => name !== repoName)
        : [...current, repoName],
    );
  }

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 36 }}
        style={{ backgroundColor: theme.background }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            {viewer?.avatarUrl ? (
              <Image source={{ uri: viewer.avatarUrl }} style={{ width: 52, height: 52, borderRadius: 26 }} />
            ) : (
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.surface }} />
            )}
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: theme.text, fontSize: 30, fontWeight: "900" }}>
                My Work
              </Text>
              <Text selectable style={{ color: theme.secondaryText }}>
                {viewer ? `@${viewer.login}` : "Connect GitHub to get started"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate("/create")}
            style={({ pressed }) => ({
              width: 50,
              height: 50,
              borderRadius: 25,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text style={{ color: theme.text, fontSize: 32, lineHeight: 34 }}>+</Text>
          </Pressable>
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader title="My Work" />
          <Card gap={0}>
            {workItems.map((item, index) => (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                onPress={() => router.navigate(item.target)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.72 : 1,
                  minHeight: 70,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  borderBottomWidth: index === workItems.length - 1 ? 0 : 1,
                  borderBottomColor: theme.border,
                })}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: item.color,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>{item.title.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>{item.title}</Text>
                  <Text style={{ color: theme.secondaryText }}>{item.subtitle}</Text>
                </View>
                {item.title === "Drafts" && draftCount > 0 ? <Pill label={String(draftCount)} active tone="blue" /> : null}
                <Text style={{ color: theme.mutedText, fontSize: 24 }}>{">"}</Text>
              </Pressable>
            ))}
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader title="Favorites" onPress={token ? openFavoritesEditor : undefined} />
          {!token ? (
            <Card>
              <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>
                GitHub is not connected
              </Text>
              <Text selectable style={{ color: theme.secondaryText, lineHeight: 20 }}>
                Add a token to show repositories here and make the app feel like a lightweight GitHub client.
              </Text>
              <Button title="Connect GitHub" onPress={() => router.navigate("/settings")} filled />
            </Card>
          ) : loading ? (
            <Card>
              <ActivityIndicator color={theme.blue} />
              <Text style={{ color: theme.secondaryText, textAlign: "center" }}>Loading repositories...</Text>
            </Card>
          ) : repos.length === 0 ? (
            <Card>
              <Text selectable style={{ color: theme.secondaryText }}>
                {favoriteRepoNames?.length === 0 ? "No favorites selected." : "No repositories found."}
              </Text>
              {allRepos.length > 0 ? <Button title="Edit Favorites" onPress={openFavoritesEditor} filled /> : null}
            </Card>
          ) : (
            <Card gap={0}>
              {repos.map((repo, index) => (
                <Pressable
                  key={repo.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.navigate({
                      pathname: "/inbox",
                      params: { repo: repo.fullName },
                    })
                  }
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.72 : 1,
                    minHeight: 66,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderBottomWidth: index === repos.length - 1 ? 0 : 1,
                    borderBottomColor: theme.border,
                  })}
                >
                  {repo.ownerAvatarUrl ? (
                    <Image
                      source={{ uri: repo.ownerAvatarUrl }}
                      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.elevated }}
                    />
                  ) : (
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.elevated }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.secondaryText, fontWeight: "700" }}>{repo.owner}</Text>
                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>{repo.name}</Text>
                  </View>
                  <Text style={{ color: theme.mutedText, fontSize: 24 }}>{">"}</Text>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={editingFavorites}
        onRequestClose={() => setEditingFavorites(false)}
      >
        <Screen>
          <View
            style={{
              minHeight: 88,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 20,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel editing favorites"
              onPress={() => setEditingFavorites(false)}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.elevated,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Ionicons name="close" color={theme.text} size={28} />
            </Pressable>
            <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>
              Edit Favorites
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save favorites"
              onPress={() => void saveFavorites()}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.blue,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Ionicons name="checkmark" color={theme.blueText} size={30} />
            </Pressable>
          </View>
          <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ paddingBottom: 32 }}>
            <Text selectable style={{ color: theme.secondaryText, lineHeight: 20, padding: 16 }}>
              Select the repositories shown on Home. Favorites open directly in Issues.
            </Text>
            {allRepos.map((repo) => (
              <Pressable
                key={repo.id}
                accessibilityRole="button"
                accessibilityState={{ selected: draftFavoriteRepoNames.includes(repo.fullName) }}
                onPress={() => toggleFavoriteRepo(repo.fullName)}
                style={({ pressed }) => ({
                  minHeight: 68,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  backgroundColor: theme.surface,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                {repo.ownerAvatarUrl ? (
                  <Image source={{ uri: repo.ownerAvatarUrl }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                ) : (
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.elevated }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: theme.secondaryText, fontWeight: "700" }}>
                    {repo.owner}
                  </Text>
                  <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
                    {repo.name}
                  </Text>
                </View>
                {draftFavoriteRepoNames.includes(repo.fullName) ? (
                  <Ionicons name="checkmark-circle" color={theme.blue} size={24} />
                ) : (
                  <Ionicons name="ellipse-outline" color={theme.mutedText} size={24} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

function SectionHeader(props: { title: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text selectable style={{ color: theme.text, fontSize: 25, fontWeight: "900" }}>
        {props.title}
      </Text>
      {props.onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${props.title}`}
          onPress={props.onPress}
          style={({ pressed }) => ({
            minWidth: 44,
            minHeight: 44,
            alignItems: "flex-end",
            justifyContent: "center",
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Ionicons name="ellipsis-horizontal" color={theme.mutedText} size={26} />
        </Pressable>
      ) : null}
    </View>
  );
}

function resolveFavoriteRepos(repos: GitHubRepo[], favoriteNames: string[] | null): GitHubRepo[] {
  if (favoriteNames === null) {
    return repos.slice(0, 3);
  }

  const byName = new Map(repos.map((repo) => [repo.fullName, repo]));
  return favoriteNames.map((name) => byName.get(name)).filter((repo): repo is GitHubRepo => Boolean(repo));
}
