import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Button, Card, Screen, useTheme } from "@/components/ui";
import { parseDesktopBridgePairingUrl, saveDesktopBridge, testDesktopBridge } from "@/lib/desktop-bridge";

export default function PairDesktopScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ url?: string; token?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const pairingInFlightRef = useRef(false);

  useEffect(() => {
    if (!params.url || !params.token) {
      return;
    }
    const directPairingUrl = `ghi://pair?url=${encodeURIComponent(params.url)}&token=${encodeURIComponent(params.token)}`;
    void handlePairingCode(directPairingUrl);
  }, [params.token, params.url]);

  async function handleScanned(result: BarcodeScanningResult) {
    await handlePairingCode(result.data);
  }

  async function handlePairingCode(value: string) {
    if (pairingInFlightRef.current) {
      return;
    }
    pairingInFlightRef.current = true;
    setScanned(true);

    try {
      const bridge = parseDesktopBridgePairingUrl(value);
      const health = await testDesktopBridge(bridge);
      await saveDesktopBridge(bridge);
      Alert.alert("Desktop paired", health.repo ? `Connected to ${health.repo}.` : "Desktop bridge saved.", [
        { text: "Done", onPress: () => router.replace("/settings") },
      ]);
    } catch (error) {
      pairingInFlightRef.current = false;
      setScanned(false);
      Alert.alert("Could not pair desktop", error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{
            minHeight: 72,
            paddingHorizontal: 16,
            paddingTop: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Settings"
            onPress={() => router.replace("/settings")}
            style={({ pressed }) => ({
              minHeight: 44,
              minWidth: 104,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Ionicons name="chevron-back" color={theme.blue} size={28} />
            <Text style={{ color: theme.blue, fontSize: 17, fontWeight: "800" }}>Settings</Text>
          </Pressable>
        </View>

        {!permission ? (
          <PairMessage title="Camera loading" message="Preparing the camera permission prompt." />
        ) : !permission.granted ? (
          <View style={{ padding: 16 }}>
            <Card gap={10}>
              <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>
                Camera access needed
              </Text>
              <Text selectable style={{ color: theme.secondaryText, lineHeight: 20 }}>
                Scan the QR code printed by `ghi mobile serve` to pair this phone with your desktop CLI.
              </Text>
              <Button title="Allow Camera" onPress={() => void requestPermission()} filled />
            </Card>
          </View>
        ) : (
          <View style={{ flex: 1, padding: 16, gap: 14 }}>
            <View style={{ gap: 4 }}>
              <Text selectable style={{ color: theme.text, fontSize: 32, fontWeight: "900" }}>
                Pair Desktop
              </Text>
              <Text selectable style={{ color: theme.secondaryText, lineHeight: 20 }}>
                Point the camera at the QR code from `ghi mobile serve`.
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minHeight: 340,
                borderRadius: 18,
                borderCurve: "continuous",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scanned ? undefined : (result) => void handleScanned(result)}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 36,
                  right: 36,
                  top: "27%",
                  aspectRatio: 1,
                  borderRadius: 22,
                  borderWidth: 3,
                  borderColor: theme.blue,
                }}
              />
            </View>

            <Text selectable style={{ color: theme.mutedText, textAlign: "center", lineHeight: 20 }}>
              The pairing token stays on this device and is used only for local bridge requests.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

function PairMessage(props: { title: string; message: string }) {
  const theme = useTheme();
  return (
    <View style={{ padding: 16 }}>
      <Card>
        <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: "900" }}>
          {props.title}
        </Text>
        <Text selectable style={{ color: theme.secondaryText, lineHeight: 20 }}>
          {props.message}
        </Text>
      </Card>
    </View>
  );
}
