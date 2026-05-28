import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Button, Field, Screen, type Theme, useTheme } from "@/components/ui";
import { clearDesktopBridge, loadDesktopBridge, saveDesktopBridge, testDesktopBridge, type DesktopBridgeConfig, type DesktopBridgeHealth } from "@/lib/desktop-bridge";
import { getViewer, type GitHubUser } from "@/lib/github";
import { clearIssueCaches } from "@/lib/issue-cache";
import { clearRepositoryCache } from "@/lib/repository-cache";
import { clearGitHubToken, loadGitHubToken, saveGitHubToken } from "@/lib/session";

export default function SettingsScreen() {
  const theme = useTheme();
  const [tokenInput, setTokenInput] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<GitHubUser | null>(null);
  const [bridge, setBridge] = useState<DesktopBridgeConfig | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [bridgeHealth, setBridgeHealth] = useState<DesktopBridgeHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkingBridge, setCheckingBridge] = useState(false);

  const refresh = useCallback(async () => {
    const token = await loadGitHubToken();
    const nextBridge = await loadDesktopBridge();
    setSavedToken(token);
    setBridge(nextBridge);
    if (nextBridge) {
      setBridgeUrl(nextBridge.url);
      setBridgeToken(nextBridge.token);
    }
    if (!token) {
      setViewer(null);
      return;
    }

    try {
      setViewer(await getViewer(token));
    } catch {
      setViewer(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handleSave() {
    if (tokenInput.trim().length < 20) {
      Alert.alert("Paste a token", "Use a fine-grained GitHub token with repository issues access.");
      return;
    }

    setChecking(true);
    try {
      const user = await getViewer(tokenInput.trim());
      await saveGitHubToken(tokenInput.trim());
      await clearRepositoryCache();
      await clearIssueCaches();
      setSavedToken(tokenInput.trim());
      setViewer(user);
      setTokenInput("");
      Alert.alert("GitHub connected", `Signed in as ${user.login}.`);
    } catch (error) {
      Alert.alert("GitHub rejected the token", error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await clearGitHubToken();
    await clearRepositoryCache();
    await clearIssueCaches();
    setSavedToken(null);
    setViewer(null);
    setTokenInput("");
  }

  async function handleSaveBridge() {
    if (!bridgeUrl.trim() || !bridgeToken.trim()) {
      Alert.alert("Add desktop bridge details", "Paste the bridge URL and pairing token from `ghi mobile serve`.");
      return;
    }

    setCheckingBridge(true);
    const nextBridge = { url: bridgeUrl.trim(), token: bridgeToken.trim() };
    try {
      const health = await testDesktopBridge(nextBridge);
      await saveDesktopBridge(nextBridge);
      setBridge(nextBridge);
      setBridgeHealth(health);
      Alert.alert("Desktop connected", health.repo ? `Connected to ${health.repo}.` : "Connected to the desktop bridge.");
    } catch (error) {
      Alert.alert("Could not reach desktop", error instanceof Error ? error.message : String(error));
    } finally {
      setCheckingBridge(false);
    }
  }

  async function handleClearBridge() {
    await clearDesktopBridge();
    setBridge(null);
    setBridgeHealth(null);
    setBridgeUrl("");
    setBridgeToken("");
  }

  async function handleClearCaches() {
    await clearRepositoryCache();
    await clearIssueCaches();
    Alert.alert("Cache cleared", "Repository and issue lists will refresh the next time you open them.");
  }

  const bridgeStatus = bridge ? bridgeHealth?.repo ?? "Bridge saved" : "Not paired";
  const accountStatus = viewer ? `@${viewer.login}` : savedToken ? "Token saved" : "Not connected";

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 44 }}
        style={{ backgroundColor: theme.background }}
      >
        <View style={{ gap: 4 }}>
          <Text selectable style={{ color: theme.text, fontSize: 38, fontWeight: "900" }}>
            Settings
          </Text>
          <Text selectable style={{ color: theme.secondaryText, fontSize: 16, lineHeight: 22 }}>
            Pair desktop Codex, connect GitHub, and manage local app data.
          </Text>
        </View>

        <SettingsSection
          title="Desktop CLI"
          footer="Start `ghi mobile serve` in the desktop repository you want mobile captures to use."
        >
          <SettingsRow
            icon="desktop-outline"
            iconColor={theme.blue}
            title="Bridge"
            detail={bridgeStatus}
            statusColor={bridge ? theme.green : theme.mutedText}
          />
          <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
            <Field
              label="URL"
              value={bridgeUrl}
              onChangeText={setBridgeUrl}
              placeholder="http://192.168.1.20:3874"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Field
              label="Pairing token"
              value={bridgeToken}
              onChangeText={setBridgeToken}
              placeholder="Paste token from ghi mobile serve"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="Scan QR" onPress={() => router.navigate("/pair")} filled />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={checkingBridge ? "Saving..." : "Save"}
                  onPress={() => void handleSaveBridge()}
                  disabled={checkingBridge}
                />
              </View>
            </View>
            {bridge ? <Button title="Forget Desktop Bridge" onPress={() => void handleClearBridge()} danger /> : null}
          </View>
        </SettingsSection>

        <SettingsSection
          title="GitHub"
          footer="Use a fine-grained token with repository access and Issues read/write permission."
        >
          <SettingsRow
            icon="logo-github"
            iconColor={theme.text}
            title="Account"
            detail={accountStatus}
            statusColor={savedToken ? theme.green : theme.mutedText}
          />
          <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
            {savedToken ? (
              <InfoStrip
                text="Token storage uses SecureStore on iOS and Android. Web preview uses local app storage."
              />
            ) : null}
            <Field
              label={savedToken ? "Replace token" : "GitHub token"}
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="github_pat_..."
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title={checking ? "Checking..." : savedToken ? "Update" : "Connect"} onPress={() => void handleSave()} filled disabled={checking} />
              </View>
              {savedToken ? (
                <View style={{ flex: 1 }}>
                  <Button title="Disconnect" onPress={() => void handleSignOut()} danger />
                </View>
              ) : null}
            </View>
          </View>
        </SettingsSection>

        <SettingsSection title="App">
          <SettingsRow icon="contrast-outline" iconColor={theme.blue} title="Appearance" detail="Follows iOS system mode" />
          <SettingsActionRow icon="server-outline" title="Cached GitHub data" detail="Repositories and issue lists" onPress={() => void handleClearCaches()} />
          <SettingsRow icon="lock-closed-outline" iconColor={theme.green} title="Secret storage" detail="SecureStore on device" last />
        </SettingsSection>
      </ScrollView>
    </Screen>
  );
}

function SettingsSection(props: { title: string; footer?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: theme.secondaryText, fontSize: 13, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" }}>
        {props.title}
      </Text>
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 16,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
          boxShadow: `0 1px 2px ${theme.shadow}`,
        }}
      >
        {props.children}
      </View>
      {props.footer ? (
        <Text selectable style={{ color: theme.mutedText, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 }}>
          {props.footer}
        </Text>
      ) : null}
    </View>
  );
}

function SettingsRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  detail: string;
  statusColor?: string;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 }}>
      <IconBox icon={props.icon} color={props.iconColor} theme={theme} />
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 12, borderBottomWidth: props.last ? 0 : 1, borderBottomColor: theme.border }}>
        <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "800" }}>
          {props.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 }}>
          {props.statusColor ? <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: props.statusColor }} /> : null}
          <Text selectable numberOfLines={1} style={{ flex: 1, color: theme.secondaryText, fontSize: 14 }}>
            {props.detail}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SettingsActionRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <IconBox icon={props.icon} color={theme.blue} theme={theme} />
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text selectable style={{ color: theme.text, fontSize: 17, fontWeight: "800" }}>
          {props.title}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: theme.secondaryText, fontSize: 14, marginTop: 3 }}>
          {props.detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
    </Pressable>
  );
}

function IconBox(props: { icon: keyof typeof Ionicons.glyphMap; color: string; theme: Theme }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: props.theme.elevated,
      }}
    >
      <Ionicons name={props.icon} size={20} color={props.color} />
    </View>
  );
}

function InfoStrip(props: { text: string }) {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: 12, borderCurve: "continuous", backgroundColor: theme.elevated, padding: 12 }}>
      <Text selectable style={{ color: theme.secondaryText, fontSize: 13, lineHeight: 18 }}>
        {props.text}
      </Text>
    </View>
  );
}
