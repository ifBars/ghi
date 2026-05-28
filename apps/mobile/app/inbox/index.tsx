import { Ionicons } from "@expo/vector-icons";
import { Link, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Button, Card, EmptyState, Pill, Screen, useTheme } from "@/components/ui";
import { formatGithubDate, listIssues, listRepositories, type GitHubIssue, type GitHubRepo } from "@/lib/github";
import { buildIssueCacheKey, loadIssueCache, saveIssueCache } from "@/lib/issue-cache";
import { loadRepositoryCache, saveRepositoryCache } from "@/lib/repository-cache";
import { loadGitHubToken, loadSelectedRepo, saveSelectedRepo } from "@/lib/session";

type IssueStateFilter = "open" | "closed" | "all";
type RepositoryFilter = "selected" | "global" | "repo";
type FilterSheet = "state" | "repository" | "label" | null;
type IssueRow = GitHubIssue & { repoName: string };

const GLOBAL_REPO_LIMIT = 15;

const issuesScreenMemory: {
  token: string | null;
  selectedRepo: string;
  repoFilter: RepositoryFilter;
  specificRepo: string;
  repos: GitHubRepo[];
  issues: IssueRow[];
  stateFilter: IssueStateFilter;
  labelFilter: string;
  issueCacheKey: string;
} = {
  token: null,
  selectedRepo: "",
  repoFilter: "selected",
  specificRepo: "",
  repos: [],
  issues: [],
  stateFilter: "open",
  labelFilter: "all",
  issueCacheKey: "",
};

export default function IssuesScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ repo?: string }>();
  const [token, setTokenState] = useState<string | null>(issuesScreenMemory.token);
  const [selectedRepo, setSelectedRepoState] = useState(issuesScreenMemory.selectedRepo);
  const [repoFilter, setRepoFilterState] = useState<RepositoryFilter>(issuesScreenMemory.repoFilter);
  const [specificRepo, setSpecificRepoState] = useState(issuesScreenMemory.specificRepo);
  const [repos, setReposState] = useState<GitHubRepo[]>(issuesScreenMemory.repos);
  const [issues, setIssuesState] = useState<IssueRow[]>(issuesScreenMemory.issues);
  const [stateFilter, setStateFilterState] = useState<IssueStateFilter>(issuesScreenMemory.stateFilter);
  const [labelFilter, setLabelFilterState] = useState(issuesScreenMemory.labelFilter);
  const [activeSheet, setActiveSheet] = useState<FilterSheet>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const issueCacheKeyRef = useRef(issuesScreenMemory.issueCacheKey);
  const issueCountRef = useRef(issuesScreenMemory.issues.length);

  const labelOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const issue of issues) {
      for (const label of issue.labels) {
        labels.add(label);
      }
    }
    return [...labels].sort((a, b) => a.localeCompare(b)).slice(0, 20);
  }, [issues]);

  const visibleIssues = useMemo(() => {
    if (labelFilter === "all") {
      return issues;
    }
    return issues.filter((issue) => issue.labels.includes(labelFilter));
  }, [issues, labelFilter]);

  const repositoryTitle = useMemo(() => {
    if (repoFilter === "global") {
      return "All repos";
    }
    if (repoFilter === "repo") {
      return shortRepoName(specificRepo) || "Repository";
    }
    return shortRepoName(selectedRepo) || "Repository";
  }, [repoFilter, selectedRepo, specificRepo]);

  function updateIssues(nextIssues: IssueRow[]) {
    issuesScreenMemory.issues = nextIssues;
    issueCountRef.current = nextIssues.length;
    setIssuesState(nextIssues);
  }

  function updateToken(nextToken: string | null) {
    issuesScreenMemory.token = nextToken;
    setTokenState(nextToken);
  }

  function updateSelectedRepo(nextRepo: string) {
    issuesScreenMemory.selectedRepo = nextRepo;
    setSelectedRepoState(nextRepo);
  }

  function updateRepos(nextRepos: GitHubRepo[]) {
    issuesScreenMemory.repos = nextRepos;
    setReposState(nextRepos);
  }

  function updateIssueCacheKey(nextKey: string) {
    issuesScreenMemory.issueCacheKey = nextKey;
    issueCacheKeyRef.current = nextKey;
  }

  function updateStateFilter(nextState: IssueStateFilter) {
    issuesScreenMemory.stateFilter = nextState;
    setStateFilterState(nextState);
  }

  function updateRepoFilter(nextFilter: RepositoryFilter) {
    issuesScreenMemory.repoFilter = nextFilter;
    setRepoFilterState(nextFilter);
  }

  function updateSpecificRepo(nextRepo: string) {
    issuesScreenMemory.specificRepo = nextRepo;
    setSpecificRepoState(nextRepo);
  }

  function updateLabelFilter(nextLabel: string) {
    issuesScreenMemory.labelFilter = nextLabel;
    setLabelFilterState(nextLabel);
  }

  const refresh = useCallback(async () => {
    const storedToken = await loadGitHubToken();
    const repoParam = typeof params.repo === "string" ? params.repo.trim() : "";
    const effectiveRepoFilter: RepositoryFilter = repoParam ? "selected" : repoFilter;
    const nextSelectedRepo = repoParam || await loadSelectedRepo("issues");
    updateToken(storedToken);
    updateSelectedRepo(nextSelectedRepo);
    if (repoParam) {
      await saveSelectedRepo("issues", repoParam);
      updateRepoFilter("selected");
      updateSpecificRepo("");
      updateLabelFilter("all");
    }

    if (!storedToken) {
      updateIssues([]);
      updateRepos([]);
      setLoading(false);
      return;
    }

    const targetRepo = effectiveRepoFilter === "repo" ? specificRepo : nextSelectedRepo;
    const cacheKey = buildIssueCacheKey({
      state: stateFilter,
      scope: effectiveRepoFilter,
      repo: effectiveRepoFilter === "global" ? "global" : targetRepo,
    });
    const cachedIssues = await loadIssueCache(cacheKey);
    const keyChanged = issueCacheKeyRef.current !== cacheKey;

    if (cachedIssues) {
      updateIssues(cachedIssues);
      updateIssueCacheKey(cacheKey);
    } else if (keyChanged) {
      updateIssues([]);
      updateIssueCacheKey(cacheKey);
    }

    setLoading(!cachedIssues && (keyChanged || issueCountRef.current === 0));
    try {
      let cachedRepos = await loadRepositoryCache();
      if (!cachedRepos && effectiveRepoFilter === "global") {
        cachedRepos = await listRepositories(storedToken);
        await saveRepositoryCache(cachedRepos);
      }
      if (cachedRepos) {
        updateRepos(cachedRepos);
      }

      if (effectiveRepoFilter !== "global" && !targetRepo) {
        updateIssues([]);
        setLoading(false);
        return;
      }

      if (effectiveRepoFilter !== "global") {
        const nextIssues = await listIssues(storedToken, targetRepo, stateFilter);
        const nextRows = nextIssues.map((issue) => ({ ...issue, repoName: targetRepo }));
        updateIssues(nextRows);
        updateIssueCacheKey(cacheKey);
        await saveIssueCache(cacheKey, nextRows);
        return;
      }

      let globalRepos = cachedRepos;
      if (!globalRepos) {
        globalRepos = await listRepositories(storedToken);
        await saveRepositoryCache(globalRepos);
        updateRepos(globalRepos);
      }

      const issueGroups = await Promise.all(
        globalRepos.slice(0, GLOBAL_REPO_LIMIT).map(async (nextRepo) => {
          try {
            const nextIssues = await listIssues(storedToken, nextRepo.fullName, stateFilter);
            return nextIssues.map((issue) => ({ ...issue, repoName: nextRepo.fullName }));
          } catch {
            return [];
          }
        }),
      );

      const nextRows = issueGroups.flat().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      updateIssues(nextRows);
      updateIssueCacheKey(cacheKey);
      await saveIssueCache(cacheKey, nextRows);
    } catch (error) {
      if (!cachedIssues && issueCountRef.current === 0) {
        Alert.alert("Could not load issues", error instanceof Error ? error.message : String(error));
      }
    } finally {
      setLoading(false);
    }
  }, [params.repo, repoFilter, specificRepo, stateFilter]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function selectState(nextState: IssueStateFilter) {
    updateLabelFilter("all");
    updateStateFilter(nextState);
    setActiveSheet(null);
  }

  function selectRepository(nextFilter: RepositoryFilter, repoName = "") {
    updateLabelFilter("all");
    updateRepoFilter(nextFilter);
    updateSpecificRepo(repoName);
    setActiveSheet(null);
  }

  function selectLabel(label: string) {
    updateLabelFilter(label);
    setActiveSheet(null);
  }

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl tintColor={theme.blue} refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 36 }}
        style={{ backgroundColor: theme.background }}
      >
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text selectable style={{ color: theme.text, fontSize: 38, fontWeight: "900" }}>
              Issues
            </Text>
            <Link href="/create" asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  backgroundColor: theme.blue,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Text style={{ color: theme.blueText, fontWeight: "900" }}>New</Text>
              </Pressable>
            </Link>
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <FilterPill label={stateLabel(stateFilter)} onPress={() => setActiveSheet("state")} />
            <FilterPill label={repositoryTitle} onPress={() => setActiveSheet("repository")} />
            <FilterPill label={labelFilter === "all" ? "Labels" : labelFilter} onPress={() => setActiveSheet("label")} />
          </View>
        </View>

        {!token ? (
          <EmptyState
            title="Connect GitHub"
            message="Add a GitHub token to browse repositories, view issues, and create ai-draft issues from the mobile app."
            action={<Button title="Open Account" onPress={() => router.navigate("/settings")} filled />}
          />
        ) : repoFilter !== "global" && !(repoFilter === "repo" ? specificRepo : selectedRepo) ? (
          <EmptyState
            title="Choose a repository"
            message="Select a repository before browsing issues or opening a new one."
            action={
              <Button
                title="Browse Repositories"
                onPress={() =>
                  router.navigate({
                    pathname: "/repos",
                    params: { returnTo: "inbox", scope: "issues" },
                  })
                }
                filled
              />
            }
          />
        ) : loading ? (
          <Card>
            <ActivityIndicator color={theme.blue} />
            <Text style={{ color: theme.secondaryText, textAlign: "center" }}>Loading issues...</Text>
          </Card>
        ) : visibleIssues.length === 0 ? (
          <EmptyState
            title="No matching issues"
            message="Adjust the state, repository, or label filter, or create a new ai-draft from Capture."
          />
        ) : (
          visibleIssues.map((issue) => (
            <IssueCard key={`${issue.repoName}-${issue.id}`} issue={issue} showRepo={repoFilter === "global"} />
          ))
        )}
      </ScrollView>

      <FilterModal
        title="Filter by State"
        visible={activeSheet === "state"}
        onClose={() => setActiveSheet(null)}
      >
        <SheetOption label="Open" selected={stateFilter === "open"} onPress={() => selectState("open")} />
        <SheetOption label="Closed" selected={stateFilter === "closed"} onPress={() => selectState("closed")} />
        <SheetOption label="All" selected={stateFilter === "all"} onPress={() => selectState("all")} />
      </FilterModal>

      <FilterModal
        title="Filter by Repository"
        visible={activeSheet === "repository"}
        onClose={() => setActiveSheet(null)}
      >
        {selectedRepo ? (
          <SheetOption label={shortRepoName(selectedRepo)} eyebrow="Selected repository" selected={repoFilter === "selected"} onPress={() => selectRepository("selected")} />
        ) : null}
        <SheetOption label="All cached repositories" eyebrow={`${GLOBAL_REPO_LIMIT} most recent max`} selected={repoFilter === "global"} onPress={() => selectRepository("global")} />
        {repos.map((nextRepo) => (
          <SheetOption
            key={nextRepo.id}
            label={nextRepo.name}
            eyebrow={nextRepo.owner}
            avatarUrl={nextRepo.ownerAvatarUrl}
            selected={repoFilter === "repo" && specificRepo === nextRepo.fullName}
            onPress={() => selectRepository("repo", nextRepo.fullName)}
          />
        ))}
      </FilterModal>

      <FilterModal
        title="Filter by Label"
        visible={activeSheet === "label"}
        onClose={() => setActiveSheet(null)}
      >
        <SheetOption label="All labels" selected={labelFilter === "all"} onPress={() => selectLabel("all")} />
        {labelOptions.length === 0 ? (
          <Text selectable style={{ color: theme.secondaryText, padding: 16, lineHeight: 20 }}>
            No labels are available in the current issue set.
          </Text>
        ) : (
          labelOptions.map((label) => (
            <SheetOption key={label} label={label} selected={labelFilter === label} onPress={() => selectLabel(label)} />
          ))
        )}
      </FilterModal>
    </Screen>
  );
}

function FilterPill(props: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 12,
        backgroundColor: theme.elevated,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text numberOfLines={1} style={{ color: theme.text, fontWeight: "800", maxWidth: 150 }}>
        {props.label}
      </Text>
      <Ionicons name="chevron-down" color={theme.secondaryText} size={15} />
    </Pressable>
  );
}

function FilterModal(props: { title: string; visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={props.visible} onRequestClose={props.onClose}>
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
            onPress={props.onClose}
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
            {props.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={props.onClose}
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
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} style={{ backgroundColor: theme.background }}>
          {props.children}
        </ScrollView>
      </Screen>
    </Modal>
  );
}

function SheetOption(props: {
  label: string;
  eyebrow?: string;
  avatarUrl?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
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
      {props.avatarUrl ? (
        <Image source={{ uri: props.avatarUrl }} style={{ width: 34, height: 34, borderRadius: 17 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        {props.eyebrow ? (
          <Text selectable style={{ color: theme.secondaryText, fontWeight: "700" }}>
            {props.eyebrow}
          </Text>
        ) : null}
        <Text selectable style={{ color: props.selected ? theme.blue : theme.text, fontSize: 18, fontWeight: "800" }}>
          {props.label}
        </Text>
      </View>
      {props.selected ? <Ionicons name="checkmark" color={theme.blue} size={24} /> : null}
    </Pressable>
  );
}

function IssueCard(props: { issue: IssueRow; showRepo: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.navigate({
          pathname: "/inbox/issue",
          params: { repo: props.issue.repoName, number: String(props.issue.number) },
        })
      }
      style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
    >
      <Card gap={9}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pill label={`#${props.issue.number}`} active tone={props.issue.state === "open" ? "green" : "gray"} />
          <Text style={{ color: theme.mutedText, fontSize: 12, fontWeight: "700" }}>
            updated {formatGithubDate(props.issue.updatedAt)}
          </Text>
        </View>
        {props.showRepo ? (
          <Text selectable style={{ color: theme.secondaryText, fontWeight: "800" }}>
            {props.issue.repoName}
          </Text>
        ) : null}
        <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "800", lineHeight: 22 }}>
          {props.issue.title}
        </Text>
        <Text selectable style={{ color: theme.secondaryText }}>
          opened by {props.issue.author} - {props.issue.comments} comments
        </Text>
        {props.issue.labels.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {props.issue.labels.slice(0, 4).map((label) => <Pill key={label} label={label} />)}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function stateLabel(state: IssueStateFilter): string {
  if (state === "closed") {
    return "Closed";
  }
  if (state === "all") {
    return "All";
  }
  return "Open";
}

function shortRepoName(repoName: string): string {
  return repoName.split("/").at(-1) ?? repoName;
}
