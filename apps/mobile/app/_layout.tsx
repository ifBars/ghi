import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/components/ui";

export default function Layout() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} backgroundColor={theme.background} />
      <Tabs
        screenOptions={{
          headerTransparent: true,
          headerShadowVisible: false,
          headerTitleStyle: { color: theme.text },
          sceneStyle: { backgroundColor: theme.background },
          tabBarActiveTintColor: theme.blue,
          tabBarInactiveTintColor: theme.mutedText,
          tabBarStyle: {
            backgroundColor: theme.tabBar,
            borderTopColor: theme.border,
          },
          tabBarLabelStyle: { fontWeight: "700" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarLabel: "Home",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: "Issues",
            tabBarLabel: "Issues",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Ionicons name="file-tray" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: "Capture",
            tabBarLabel: "Capture",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Ionicons name="create" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarLabel: "Settings",
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
          }}
        />
        <Tabs.Screen name="drafts" options={{ title: "Drafts", href: null }} />
        <Tabs.Screen name="repos" options={{ title: "Repositories", href: null, headerShown: false }} />
        <Tabs.Screen name="pair" options={{ title: "Pair Desktop", href: null, headerShown: false }} />
      </Tabs>
    </>
  );
}
