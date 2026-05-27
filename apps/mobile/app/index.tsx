import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  PlatformColor,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { createIssuePreview, formatHandoff, saveDraft, type IntakeKind, type MobileDraft } from "@/lib/drafts";

const kinds: IntakeKind[] = ["bug", "feature", "idea", "task"];

export default function CaptureScreen() {
  const [kind, setKind] = useState<IntakeKind>("bug");
  const [repository, setRepository] = useState("");
  const [report, setReport] = useState("");
  const [context, setContext] = useState("");

  const preview = useMemo(
    () => createIssuePreview({ kind, repository, report, context }),
    [kind, repository, report, context],
  );

  async function handleSave() {
    if (report.trim().length < 4) {
      Alert.alert("Add a report", "Capture at least a few words before saving.");
      return;
    }

    const draft: MobileDraft = {
      id: `${Date.now()}`,
      kind,
      repository,
      report,
      context,
      title: preview.title,
      body: preview.body,
      createdAt: new Date().toISOString(),
    };

    await saveDraft(draft);
    if (process.env.EXPO_OS === "ios") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Draft saved", "Your capture is in the local draft inbox.");
    setReport("");
    setContext("");
  }

  async function handleShare() {
    const draft: MobileDraft = {
      id: "preview",
      kind,
      repository,
      report,
      context,
      title: preview.title,
      body: preview.body,
      createdAt: new Date().toISOString(),
    };
    await Share.share({ message: formatHandoff(draft), title: preview.title });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Text selectable style={{ color: PlatformColor("secondaryLabel"), flex: 1 }}>
          Capture now. Structure in the repo later.
        </Text>
        <Link href="/drafts" asChild>
          <Pressable
            style={{
              backgroundColor: PlatformColor("systemBlue"),
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Drafts</Text>
          </Pressable>
        </Link>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "700", color: PlatformColor("label") }}>Type</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {kinds.map((item) => (
            <Pressable
              key={item}
              onPress={() => setKind(item)}
              style={{
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 9,
                backgroundColor: item === kind ? PlatformColor("label") : PlatformColor("secondarySystemGroupedBackground"),
              }}
            >
              <Text style={{ color: item === kind ? PlatformColor("systemBackground") : PlatformColor("label"), fontWeight: "700" }}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Field label="Repository" value={repository} onChangeText={setRepository} placeholder="owner/repo" />
      <Field
        label="Rough report"
        value={report}
        onChangeText={setReport}
        placeholder="inventory dupes after reconnect"
        multiline
        minHeight={104}
      />
      <Field
        label="Context"
        value={context}
        onChangeText={setContext}
        placeholder="Discord quote, screenshot note, logs, device, build, or reproduction hint"
        multiline
        minHeight={128}
      />

      <View
        style={{
          backgroundColor: PlatformColor("secondarySystemGroupedBackground"),
          borderRadius: 18,
          borderCurve: "continuous",
          padding: 16,
          gap: 10,
        }}
      >
        <Text selectable style={{ fontSize: 18, fontWeight: "800", color: PlatformColor("label") }}>
          {preview.title}
        </Text>
        <Text selectable style={{ color: PlatformColor("secondaryLabel"), lineHeight: 20 }}>
          {preview.body}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <ActionButton title="Save Draft" onPress={handleSave} filled />
        <ActionButton title="Share" onPress={handleShare} />
      </View>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  minHeight?: number;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: "700", color: PlatformColor("label") }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={PlatformColor("tertiaryLabel")}
        multiline={props.multiline}
        textAlignVertical={props.multiline ? "top" : "center"}
        style={{
          minHeight: props.minHeight ?? 48,
          borderRadius: 14,
          borderCurve: "continuous",
          padding: 14,
          backgroundColor: PlatformColor("secondarySystemGroupedBackground"),
          color: PlatformColor("label"),
          fontSize: 16,
          lineHeight: 22,
        }}
      />
    </View>
  );
}

function ActionButton(props: { title: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flex: 1,
        alignItems: "center",
        borderRadius: 14,
        borderCurve: "continuous",
        paddingVertical: 14,
        backgroundColor: props.filled ? PlatformColor("systemBlue") : PlatformColor("secondarySystemGroupedBackground"),
      }}
    >
      <Text style={{ color: props.filled ? "white" : PlatformColor("label"), fontWeight: "800" }}>{props.title}</Text>
    </Pressable>
  );
}
