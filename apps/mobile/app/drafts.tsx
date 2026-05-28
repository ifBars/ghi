import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Button, Card, EmptyState, Pill, Screen, useTheme } from "@/components/ui";
import { deleteDraft, formatHandoff, loadDrafts, type MobileDraft } from "@/lib/drafts";

export default function DraftsScreen() {
  const theme = useTheme();
  const [drafts, setDrafts] = useState<MobileDraft[]>([]);

  const refresh = useCallback(async () => {
    setDrafts(await loadDrafts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handleCopy(draft: MobileDraft) {
    await Clipboard.setStringAsync(formatHandoff(draft));
    Alert.alert("Copied", "The CLI handoff is on your clipboard.");
  }

  async function handleDelete(draft: MobileDraft) {
    await deleteDraft(draft.id);
    await refresh();
  }

  return (
    <Screen>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }}
      style={{ backgroundColor: theme.background }}
    >
      <Text selectable style={{ color: theme.text, fontSize: 38, fontWeight: "900" }}>
        Drafts
      </Text>

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          message="Saved captures appear here for CLI handoff when you want local Codex to polish the final issue."
          action={<Button title="Create Capture" onPress={() => router.navigate("/create")} filled />}
        />
      ) : (
        drafts.map((draft) => (
          <Card key={draft.id} gap={12}>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text selectable style={{ fontSize: 17, fontWeight: "900", color: theme.text, flex: 1 }}>
                  {draft.title}
                </Text>
                <Pill label={draft.kind} active />
              </View>
              <Text selectable style={{ color: theme.secondaryText }}>
                {draft.repository || "No repository"}
              </Text>
            </View>
            <Text selectable numberOfLines={5} style={{ color: theme.secondaryText, lineHeight: 20 }}>
              {draft.body}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <View style={{ flex: 1 }}>
                <Button title="Copy for CLI" onPress={() => void handleCopy(draft)} filled />
              </View>
              <Button
                title="Delete"
                danger
                onPress={() =>
                  Alert.alert("Delete draft?", draft.title, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => void handleDelete(draft) },
                  ])
                }
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
    </Screen>
  );
}
