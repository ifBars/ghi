import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GitHubMarkdown } from "@/components/github-markdown";
import { Card, EmptyState, Screen, useTheme } from "@/components/ui";
import { formatGithubDate, getIssue, listIssueComments, type GitHubIssue, type GitHubIssueComment } from "@/lib/github";
import { loadGitHubToken } from "@/lib/session";

export default function IssueDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ repo?: string; number?: string }>();
  const repo = typeof params.repo === "string" ? params.repo : "";
  const issueNumber = Number(params.number);
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [comments, setComments] = useState<GitHubIssueComment[]>([]);
  const [loadedIssueKey, setLoadedIssueKey] = useState("");
  const [attemptedIssueKey, setAttemptedIssueKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const validParams = repo.length > 0 && Number.isFinite(issueNumber) && issueNumber > 0;
  const issueKey = validParams ? `${repo}#${issueNumber}` : "";
  const visibleIssue = loadedIssueKey === issueKey ? issue : null;
  const visibleComments = loadedIssueKey === issueKey ? comments : [];
  const showSkeleton = validParams && !visibleIssue && (loading || attemptedIssueKey !== issueKey);

  const repoTitle = useMemo(() => {
    if (!validParams) {
      return "Issue";
    }
    return `${repo} #${issueNumber}`;
  }, [issueNumber, repo, validParams]);

  const refresh = useCallback(async () => {
    if (!validParams) {
      return;
    }

    const targetIssueKey = `${repo}#${issueNumber}`;
    setLoading(true);
    const token = await loadGitHubToken();
    if (!token) {
      setIssue(null);
      setComments([]);
      setLoadedIssueKey("");
      setAttemptedIssueKey(targetIssueKey);
      setLoading(false);
      return;
    }

    try {
      const [nextIssue, nextComments] = await Promise.all([
        getIssue(token, repo, issueNumber),
        listIssueComments(token, repo, issueNumber),
      ]);
      setIssue(nextIssue);
      setComments(nextComments);
      setLoadedIssueKey(targetIssueKey);
    } catch (error) {
      setLoadedIssueKey("");
      Alert.alert("Could not load issue", error instanceof Error ? error.message : String(error));
    } finally {
      setAttemptedIssueKey(targetIssueKey);
      setLoading(false);
    }
  }, [issueNumber, repo, validParams]);

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

  async function openOnGitHub(htmlUrl = visibleIssue?.htmlUrl) {
    if (!htmlUrl) {
      return;
    }

    const appUrl = toGitHubAppUrl(htmlUrl);
    if (appUrl) {
      try {
        await Linking.openURL(appUrl);
        return;
      } catch {
        // Fall back to the universal link when the GitHub app is unavailable.
      }
    }

    await Linking.openURL(htmlUrl);
  }

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        refreshControl={<RefreshControl tintColor={theme.blue} refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        contentContainerStyle={{ padding: 16, paddingTop: Math.max(insets.top + 2, 18), gap: 12, paddingBottom: 36 }}
        style={{ backgroundColor: theme.background }}
      >
        <IssueTopBar canOpen={Boolean(visibleIssue?.htmlUrl)} onOpenGitHub={() => void openOnGitHub(visibleIssue?.htmlUrl)} />

        {!validParams ? (
          <EmptyState title="Issue not found" message="The selected issue link is missing a repository or issue number." />
        ) : showSkeleton ? (
          <IssueDetailSkeleton />
        ) : !visibleIssue ? (
          <EmptyState title="Issue unavailable" message="Connect GitHub or refresh the issue list before opening this issue." />
        ) : (
          <>
            <IssueHeader issue={visibleIssue} repoTitle={repoTitle} commentCount={visibleComments.length} onOpenGitHub={() => void openOnGitHub(visibleIssue.htmlUrl)} />

            <Card gap={10}>
              <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>
                Description
              </Text>
              <GitHubMarkdown baseUrl={visibleIssue.htmlUrl} emptyText="No description provided.">
                {visibleIssue.body ?? ""}
              </GitHubMarkdown>
            </Card>

            <View style={{ gap: 10 }}>
              <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
                Comments
              </Text>
              {visibleComments.length === 0 ? (
                <Card>
                  <Text selectable style={{ color: theme.secondaryText }}>
                    No comments yet.
                  </Text>
                </Card>
              ) : (
                visibleComments.map((comment) => <CommentCard key={comment.id} comment={comment} />)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function IssueTopBar(props: { canOpen: boolean; onOpenGitHub: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Issues"
        hitSlop={{ top: 10, right: 18, bottom: 10, left: 10 }}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/inbox");
          }
        }}
        style={({ pressed }) => ({
          minHeight: 44,
          minWidth: 104,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          borderRadius: 13,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Ionicons name="chevron-back" color={theme.blue} size={28} />
        <Text style={{ color: theme.blue, fontSize: 17, fontWeight: "800" }}>Issues</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open issue on GitHub"
        disabled={!props.canOpen}
        hitSlop={10}
        onPress={props.onOpenGitHub}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          backgroundColor: theme.elevated,
          opacity: !props.canOpen ? 0.42 : pressed ? 0.72 : 1,
        })}
      >
        <Ionicons name="open-outline" color={theme.text} size={20} />
      </Pressable>
    </View>
  );
}

function IssueHeader(props: { issue: GitHubIssue; repoTitle: string; commentCount: number; onOpenGitHub: () => void }) {
  const theme = useTheme();
  const labelPreview = props.issue.labels.slice(0, 3);
  const remainingLabels = props.issue.labels.length - labelPreview.length;
  const stateColor = props.issue.state === "open" ? theme.green : theme.mutedText;
  const stateLabel = props.issue.state === "open" ? "Open" : "Closed";

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
        boxShadow: `0 1px 2px ${theme.shadow}`,
      }}
    >
      <View style={{ padding: 14, gap: 11 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Text selectable numberOfLines={1} style={{ flex: 1, color: theme.secondaryText, fontSize: 14, fontWeight: "800" }}>
            {props.repoTitle}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              borderRadius: 999,
              backgroundColor: theme.elevated,
              paddingHorizontal: 9,
              paddingVertical: 5,
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: stateColor }} />
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: "900" }}>{stateLabel}</Text>
          </View>
        </View>

        <Text selectable style={{ color: theme.text, fontSize: 26, fontWeight: "900", lineHeight: 31 }}>
          {props.issue.title}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {props.issue.authorAvatarUrl ? (
            <Image source={{ uri: props.issue.authorAvatarUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
          ) : (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.elevated }} />
          )}
          <View style={{ flex: 1 }}>
            <Text selectable numberOfLines={1} style={{ color: theme.text, fontWeight: "900" }}>
              {props.issue.author}
            </Text>
            <Text selectable numberOfLines={1} style={{ color: theme.secondaryText, fontSize: 13, fontWeight: "700" }}>
              updated {formatGithubDate(props.issue.updatedAt)} - {props.commentCount} {props.commentCount === 1 ? "comment" : "comments"}
            </Text>
          </View>
        </View>

        {props.issue.labels.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {labelPreview.map((label) => <CompactLabel key={label} label={label} />)}
            {remainingLabels > 0 ? <CompactLabel label={`+${remainingLabels}`} /> : null}
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open issue on GitHub"
        onPress={props.onOpenGitHub}
        style={({ pressed }) => ({
          minHeight: 46,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: pressed ? theme.elevated : theme.surface,
        })}
      >
        <Ionicons name="logo-github" color={theme.text} size={19} />
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: "900" }}>Open on GitHub</Text>
      </Pressable>
    </View>
  );
}

function CompactLabel(props: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        backgroundColor: theme.elevated,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text numberOfLines={1} style={{ color: theme.secondaryText, fontSize: 12, fontWeight: "800" }}>
        {props.label}
      </Text>
    </View>
  );
}

function IssueDetailSkeleton() {
  return (
    <>
      <SkeletonIssueHeader />
      <Card gap={12}>
        <SkeletonLine width="42%" height={24} />
        <View style={{ gap: 9 }}>
          <SkeletonLine width="94%" />
          <SkeletonLine width="88%" />
          <SkeletonLine width="78%" />
        </View>
        <View style={{ gap: 9, paddingTop: 8 }}>
          <SkeletonLine width="90%" />
          <SkeletonLine width="96%" />
          <SkeletonLine width="72%" />
        </View>
      </Card>
      <View style={{ gap: 10 }}>
        <SkeletonLine width="34%" height={28} />
        <Card gap={10}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <SkeletonCircle size={30} />
            <View style={{ flex: 1, gap: 7 }}>
              <SkeletonLine width="38%" />
              <SkeletonLine width="28%" height={12} />
            </View>
          </View>
          <SkeletonLine width="92%" />
          <SkeletonLine width="64%" />
        </Card>
      </View>
    </>
  );
}

function SkeletonIssueHeader() {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
        boxShadow: `0 1px 2px ${theme.shadow}`,
      }}
    >
      <View style={{ padding: 14, gap: 11 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <SkeletonLine width="48%" height={19} />
          <SkeletonLine width={74} height={28} radius={999} />
        </View>
        <View style={{ gap: 8 }}>
          <SkeletonLine width="72%" height={31} />
          <SkeletonLine width="46%" height={31} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <SkeletonCircle size={32} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonLine width="44%" height={16} />
            <SkeletonLine width="62%" height={14} />
          </View>
        </View>
        <SkeletonLine width={116} height={26} radius={999} />
      </View>
      <View style={{ minHeight: 46, borderTopWidth: 1, borderTopColor: theme.border, alignItems: "center", justifyContent: "center" }}>
        <SkeletonLine width="42%" height={20} />
      </View>
    </View>
  );
}

function SkeletonLine(props: { width: number | `${number}%`; height?: number; radius?: number }) {
  const theme = useTheme();
  const opacity = useSkeletonOpacity();
  return (
    <Animated.View
      style={{
        width: props.width,
        height: props.height ?? 16,
        borderRadius: props.radius ?? 7,
        backgroundColor: theme.elevated,
        opacity,
      }}
    />
  );
}

function SkeletonCircle(props: { size: number }) {
  const theme = useTheme();
  const opacity = useSkeletonOpacity();
  return (
    <Animated.View
      style={{
        width: props.size,
        height: props.size,
        borderRadius: props.size / 2,
        backgroundColor: theme.elevated,
        opacity,
      }}
    />
  );
}

function useSkeletonOpacity() {
  const opacity = useRef(new Animated.Value(0.52)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.92,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.52,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return opacity;
}

function CommentCard(props: { comment: GitHubIssueComment }) {
  const theme = useTheme();
  return (
    <Card gap={10}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {props.comment.authorAvatarUrl ? (
          <Image source={{ uri: props.comment.authorAvatarUrl }} style={{ width: 30, height: 30, borderRadius: 15 }} />
        ) : (
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.elevated }} />
        )}
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: theme.text, fontWeight: "900" }}>
            {props.comment.author}
          </Text>
          <Text selectable style={{ color: theme.mutedText, fontSize: 12, fontWeight: "700" }}>
            updated {formatGithubDate(props.comment.updatedAt)}
          </Text>
        </View>
      </View>
      <GitHubMarkdown emptyText="No comment body.">{props.comment.body}</GitHubMarkdown>
    </Card>
  );
}

function toGitHubAppUrl(htmlUrl: string) {
  const match = htmlUrl.match(/^https:\/\/github\.com\/(.+)$/i);
  if (!match) {
    return undefined;
  }

  return `github://github.com/${match[1]}`;
}
