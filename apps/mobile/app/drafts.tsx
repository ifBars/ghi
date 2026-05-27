import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, PlatformColor, Pressable, ScrollView, Share, Text, View } from "react-native";
import { deleteDraft, formatHandoff, loadDrafts, type MobileDraft } from "@/lib/drafts";

export default function DraftsScreen() {
  const [drafts, setDrafts] = useState<MobileDraft[]>([]);

  const refresh = useCallback(async () => {
    setDrafts(await loadDrafts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handleShare(draft: MobileDraft) {
    await Share.share({ message: formatHandoff(draft), title: draft.title });
  }

  async function handleDelete(draft: MobileDraft) {
    await deleteDraft(draft.id);
    await refresh();
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 14 }}>
      {drafts.length === 0 ? (
        <View
          style={{
            backgroundColor: PlatformColor("secondarySystemGroupedBackground"),
            borderRadius: 18,
            borderCurve: "continuous",
            padding: 18,
            gap: 8,
          }}
        >
          <Text selectable style={{ fontSize: 18, fontWeight: "800", color: PlatformColor("label") }}>
            No drafts yet
          </Text>
          <Text selectable style={{ color: PlatformColor("secondaryLabel"), lineHeight: 20 }}>
            Captures saved from the main screen will appear here for handoff into the CLI workflow.
          </Text>
        </View>
      ) : (
        drafts.map((draft) => (
          <View
            key={draft.id}
            style={{
              backgroundColor: PlatformColor("secondarySystemGroupedBackground"),
              borderRadius: 18,
              borderCurve: "continuous",
              padding: 16,
              gap: 12,
            }}
          >
            <View style={{ gap: 5 }}>
              <Text selectable style={{ fontSize: 17, fontWeight: "800", color: PlatformColor("label") }}>
                {draft.title}
              </Text>
              <Text selectable style={{ color: PlatformColor("secondaryLabel") }}>
                {draft.repository || "No repository"} · {draft.kind}
              </Text>
            </View>
            <Text selectable numberOfLines={5} style={{ color: PlatformColor("secondaryLabel"), lineHeight: 20 }}>
              {draft.body}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => void handleShare(draft)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  borderRadius: 12,
                  borderCurve: "continuous",
                  paddingVertical: 11,
                  backgroundColor: PlatformColor("systemBlue"),
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>Share</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  Alert.alert("Delete draft?", draft.title, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => void handleDelete(draft) },
                  ])
                }
                style={{
                  alignItems: "center",
                  borderRadius: 12,
                  borderCurve: "continuous",
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                  backgroundColor: PlatformColor("tertiarySystemGroupedBackground"),
                }}
              >
                <Text style={{ color: PlatformColor("systemRed"), fontWeight: "800" }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
