import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Keyboard, Pressable, ScrollView, Text, TextInput, TouchableWithoutFeedback, useWindowDimensions, View, type KeyboardEvent } from "react-native";
import { Button, Screen, type Theme, useTheme } from "@/components/ui";
import { loadDesktopBridge, sendCaptureToDesktopBridge } from "@/lib/desktop-bridge";
import { formatAttachmentSummary, saveDraft, type IntakeKind, type MobileAttachment, type MobileDraft } from "@/lib/drafts";
import { loadSelectedRepo } from "@/lib/session";

const kinds: IntakeKind[] = ["bug", "feature", "idea", "task"];
const maxAttachmentBytes = 8 * 1024 * 1024;

export default function CreateScreen() {
  const theme = useTheme();
  const window = useWindowDimensions();
  const [kind, setKind] = useState<IntakeKind>("bug");
  const [repository, setRepository] = useState("");
  const [report, setReport] = useState("");
  const [attachments, setAttachments] = useState<MobileAttachment[]>([]);
  const [hasDesktopBridge, setHasDesktopBridge] = useState(false);
  const [sendingDesktop, setSendingDesktop] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    function syncKeyboardFrame(event: KeyboardEvent) {
      Keyboard.scheduleLayoutAnimation(event);
      setKeyboardInset(Math.max(0, window.height - event.endCoordinates.screenY));
    }

    function clearKeyboardFrame(event: KeyboardEvent) {
      Keyboard.scheduleLayoutAnimation(event);
      setKeyboardInset(0);
    }

    const show = Keyboard.addListener(process.env.EXPO_OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", syncKeyboardFrame);
    const hide = Keyboard.addListener(process.env.EXPO_OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", clearKeyboardFrame);

    return () => {
      show.remove();
      hide.remove();
    };
  }, [window.height]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([loadSelectedRepo("capture"), loadDesktopBridge()]).then(([selectedRepo, desktopBridge]) => {
        if (!active) {
          return;
        }
        setHasDesktopBridge(Boolean(desktopBridge));
        if (selectedRepo && selectedRepo !== repository) {
          setRepository(selectedRepo);
        }
      });
      return () => {
        active = false;
      };
    }, [repository]),
  );

  async function handleSave() {
    const draft = buildDraft();
    if (!draft) {
      return;
    }

    await saveDraft(draft);
    if (process.env.EXPO_OS === "ios") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Saved for CLI", "Your capture is in local drafts.");
    resetText();
  }

  async function handleSendToDesktop() {
    const draft = buildDraft();
    if (!draft) {
      return;
    }
    if (!repository.includes("/")) {
      Alert.alert("Choose a repository", "Select the repository that matches the desktop bridge before sending.");
      return;
    }

    const bridge = await loadDesktopBridge();
    if (!bridge) {
      Alert.alert("Connect desktop CLI", "Open Settings and add the URL/token from `ghi mobile serve` first.");
      return;
    }

    setSendingDesktop(true);
    try {
      const result = await sendCaptureToDesktopBridge(bridge, {
        repo: repository.trim(),
        kind,
        report: report.trim(),
        context: formatAttachmentSummary(attachments),
        attachments,
      });
      if (process.env.EXPO_OS === "ios") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (result.job) {
        Alert.alert("Desktop job queued", `ghi is generating this in the background.\n\nJob: ${result.job.id}`);
      } else {
        Alert.alert("Desktop created issue", result.createdIssue?.url ?? result.payload?.title ?? "The desktop CLI completed the request.");
      }
      resetText();
    } catch (error) {
      Alert.alert("Desktop handoff failed", error instanceof Error ? error.message : String(error));
    } finally {
      setSendingDesktop(false);
    }
  }

  function buildDraft(): MobileDraft | null {
    if (report.trim().length < 4) {
      Alert.alert("Add a report", "Capture at least a few words before saving or creating.");
      return null;
    }

    return {
      id: `${Date.now()}`,
      kind,
      repository,
      report,
      context: formatAttachmentSummary(attachments),
      attachments,
      title: report.trim().slice(0, 80) || "Untitled ghi capture",
      body: [
        "## Mobile Capture",
        "",
        report.trim(),
        attachments.length > 0 ? "" : "",
        attachments.length > 0 ? "## Evidence" : "",
        attachments.length > 0 ? formatAttachmentSummary(attachments) : "",
      ].filter((line) => line !== "").join("\n"),
      createdAt: new Date().toISOString(),
    };
  }

  function resetText() {
    setReport("");
    setAttachments([]);
  }

  async function handleAddScreenshot() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photos unavailable", "Allow photo access to attach screenshots.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.88,
    });
    if (result.canceled) {
      return;
    }

    const next = result.assets
      .map((asset): MobileAttachment | null => {
        const size = asset.fileSize;
        if (typeof size === "number" && size > maxAttachmentBytes) {
          return null;
        }
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind: "image",
          name: asset.fileName || `screenshot-${attachments.length + 1}.jpg`,
          mimeType: asset.mimeType || "image/jpeg",
          size,
          uri: asset.uri,
          dataBase64: asset.base64 ?? undefined,
        };
      })
      .filter((attachment): attachment is MobileAttachment => attachment !== null);

    if (next.length !== result.assets.length) {
      Alert.alert("Some files skipped", "ghi skips mobile attachments larger than 8 MB.");
    }
    setAttachments((current) => [...current, ...next]);
  }

  async function handleAddFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/*", "application/json", "application/pdf", "application/zip", "application/octet-stream", "*/*"],
      multiple: true,
      copyToCacheDirectory: true,
      base64: true,
    });
    if (result.canceled) {
      return;
    }

    const next: MobileAttachment[] = [];
    for (const asset of result.assets) {
      if (typeof asset.size === "number" && asset.size > maxAttachmentBytes) {
        continue;
      }
      let dataBase64 = asset.base64;
      if (!dataBase64 && asset.uri) {
        dataBase64 = await new File(asset.uri).base64();
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind: asset.mimeType?.startsWith("image/") ? "image" : "file",
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        uri: asset.uri,
        dataBase64,
      });
    }

    if (next.length !== result.assets.length) {
      Alert.alert("Some files skipped", "ghi skips mobile attachments larger than 8 MB.");
    }
    setAttachments((current) => [...current, ...next]);
  }

  function handleRemoveAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  const bridgeLabel = hasDesktopBridge ? "Connected" : "Not paired";

  return (
    <Screen>
      <View style={{ flex: 1, paddingBottom: keyboardInset }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 12, paddingBottom: 16 }}
            style={{ backgroundColor: theme.background }}
          >
            <View style={{ gap: 3 }}>
              <Text selectable style={{ color: theme.text, fontSize: 32, fontWeight: "900" }}>
                Capture
              </Text>
              <Text selectable style={{ color: theme.secondaryText, lineHeight: 19 }}>
                Capture now. Let desktop ghi structure it in the repo.
              </Text>
            </View>

            <StatusCard
              repository={repository}
              bridgeLabel={bridgeLabel}
              connected={hasDesktopBridge}
              onSelectRepository={() =>
                router.navigate({
                  pathname: "/repos",
                  params: { returnTo: "create", scope: "capture" },
                })
              }
              onOpenSettings={() => router.navigate("/settings")}
            />

            <View
              style={{
                flexDirection: "row",
                gap: 4,
                padding: 4,
                borderRadius: 14,
                borderCurve: "continuous",
                backgroundColor: theme.elevated,
              }}
            >
              {kinds.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item === kind }}
                  onPress={() => setKind(item)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 42,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 11,
                    backgroundColor: item === kind ? theme.blue : "transparent",
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: item === kind ? theme.blueText : theme.secondaryText, fontWeight: "900" }}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ gap: 8 }}>
              <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>
                What should ghi file?
              </Text>
              <View
                style={{
                  minHeight: 180,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  padding: 14,
                  gap: 8,
                }}
              >
                <TextInput
                  value={report}
                  onChangeText={setReport}
                  placeholder="Describe the issue, feature, or task..."
                  placeholderTextColor={theme.mutedText}
                  multiline
                  textAlignVertical="top"
                  selectionColor={theme.blue}
                  returnKeyType="default"
                  blurOnSubmit={false}
                  maxLength={2000}
                  style={{
                    flex: 1,
                    minHeight: 130,
                    color: theme.text,
                    fontSize: 18,
                    lineHeight: 25,
                    padding: 0,
                  }}
                />
                <Text selectable style={{ color: theme.mutedText, fontSize: 12, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                  {report.length}/2000
                </Text>
              </View>
            </View>

            <EvidenceCard
              attachments={attachments}
              onAddScreenshot={() => void handleAddScreenshot()}
              onAddFile={() => void handleAddFile()}
              onRemove={handleRemoveAttachment}
            />
          </ScrollView>
        </TouchableWithoutFeedback>

        <View
          style={{
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.tabBar,
          }}
        >
          <Button
            title={sendingDesktop ? "Queueing..." : hasDesktopBridge ? "Send to Desktop" : "Pair Desktop CLI"}
            onPress={hasDesktopBridge ? () => void handleSendToDesktop() : () => router.navigate("/settings")}
            filled
            disabled={sendingDesktop}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="Save Draft" onPress={() => void handleSave()} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Dismiss Keyboard" onPress={Keyboard.dismiss} />
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function EvidenceCard(props: {
  attachments: MobileAttachment[];
  onAddScreenshot: () => void;
  onAddFile: () => void;
  onRemove: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}>
        Evidence
      </Text>
      <View
        style={{
          borderRadius: 16,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", gap: 10, padding: 12 }}>
          <EvidenceAction icon="image-outline" title="Screenshot" onPress={props.onAddScreenshot} />
          <EvidenceAction icon="document-attach-outline" title="File" onPress={props.onAddFile} />
        </View>
        {props.attachments.length > 0 ? (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
            {props.attachments.map((attachment, index) => (
              <View key={attachment.id}>
                {index > 0 ? <View style={{ height: 1, backgroundColor: theme.border, marginLeft: 52 }} /> : null}
                <AttachmentRow attachment={attachment} onRemove={() => props.onRemove(attachment.id)} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function EvidenceAction(props: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: theme.elevated,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Ionicons name={props.icon} color={theme.text} size={20} />
      <Text style={{ color: theme.text, fontWeight: "900" }}>{props.title}</Text>
    </Pressable>
  );
}

function AttachmentRow(props: { attachment: MobileAttachment; onRemove: () => void }) {
  const theme = useTheme();
  const detail = [
    props.attachment.kind === "image" ? "Image" : "File",
    props.attachment.mimeType,
    typeof props.attachment.size === "number" ? formatBytes(props.attachment.size) : undefined,
  ].filter(Boolean).join(" - ");

  return (
    <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12 }}>
      <Ionicons name={props.attachment.kind === "image" ? "image-outline" : "document-text-outline"} color={theme.secondaryText} size={23} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontWeight: "900" }}>
          {props.attachment.name}
        </Text>
        <Text numberOfLines={1} style={{ color: theme.secondaryText, marginTop: 2, fontSize: 13 }}>
          {detail}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${props.attachment.name}`}
        onPress={props.onRemove}
        hitSlop={10}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
      >
        <Ionicons name="close-circle" color={theme.mutedText} size={22} />
      </Pressable>
    </View>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function CompactCard(props: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        boxShadow: `0 1px 2px ${theme.shadow}`,
      }}
    >
      {props.children}
    </View>
  );
}

function StatusCard(props: {
  repository: string;
  bridgeLabel: string;
  connected: boolean;
  onSelectRepository: () => void;
  onOpenSettings: () => void;
}) {
  const theme = useTheme();
  return (
    <CompactCard>
      <StatusRow
        icon="logo-github"
        title="Repository"
        detail={props.repository || "Choose where this issue belongs"}
        theme={theme}
        onPress={props.onSelectRepository}
      />
      <View style={{ height: 1, backgroundColor: theme.border, marginLeft: 46 }} />
      <StatusRow
        icon="terminal-outline"
        title="Desktop CLI bridge"
        detail={props.connected ? "Background generation enabled" : "Pair desktop CLI to send captures"}
        badge={props.bridgeLabel}
        badgeColor={props.connected ? theme.green : theme.mutedText}
        theme={theme}
        onPress={props.onOpenSettings}
      />
    </CompactCard>
  );
}

function StatusRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  badge?: string;
  badgeColor?: string;
  theme: Theme;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: props.theme.elevated,
        }}
      >
        <Ionicons name={props.icon} color={props.theme.text} size={19} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text selectable style={{ color: props.theme.secondaryText, fontSize: 12, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>
            {props.title}
          </Text>
          {props.badge ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: props.badgeColor ?? props.theme.mutedText }} />
              <Text style={{ color: props.badgeColor ?? props.theme.secondaryText, fontSize: 12, fontWeight: "900" }}>
                {props.badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text selectable numberOfLines={1} style={{ color: props.theme.text, fontSize: 16, fontWeight: "800", marginTop: 3, lineHeight: 20 }}>
          {props.detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" color={props.theme.mutedText} size={20} />
    </Pressable>
  );
}
