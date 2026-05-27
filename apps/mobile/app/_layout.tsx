import { Stack } from "expo-router";
import { PlatformColor } from "react-native";
import { StatusBar } from "expo-status-bar";

export default function Layout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerLargeTitle: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerTitleStyle: { color: PlatformColor("label") },
          contentStyle: { backgroundColor: PlatformColor("systemGroupedBackground") },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Capture" }} />
        <Stack.Screen name="drafts" options={{ title: "Drafts" }} />
      </Stack>
    </>
  );
}
