import { Pressable, Text, TextInput, useColorScheme, View, type TextInputProps, type ViewStyle } from "react-native";

export type Theme = {
  mode: "light" | "dark";
  background: string;
  surface: string;
  elevated: string;
  text: string;
  secondaryText: string;
  mutedText: string;
  border: string;
  blue: string;
  blueText: string;
  green: string;
  red: string;
  tabBar: string;
  shadow: string;
};

const lightTheme: Theme = {
  mode: "light",
  background: "#f6f8fa",
  surface: "#ffffff",
  elevated: "#eef2f6",
  text: "#1f2328",
  secondaryText: "#57606a",
  mutedText: "#6e7781",
  border: "rgba(31, 35, 40, 0.14)",
  blue: "#0969da",
  blueText: "#ffffff",
  green: "#1a7f37",
  red: "#cf222e",
  tabBar: "#ffffff",
  shadow: "rgba(31, 35, 40, 0.08)",
};

const darkTheme: Theme = {
  mode: "dark",
  background: "#0d1117",
  surface: "#161b22",
  elevated: "#21262d",
  text: "#f0f6fc",
  secondaryText: "#8b949e",
  mutedText: "#6e7681",
  border: "#30363d",
  blue: "#58a6ff",
  blueText: "#0d1117",
  green: "#3fb950",
  red: "#f85149",
  tabBar: "#010409",
  shadow: "rgba(0, 0, 0, 0.35)",
};

export function useTheme() {
  return useColorScheme() === "dark" ? darkTheme : lightTheme;
}

export function Screen(props: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.background }, props.style]}>
      {props.children}
    </View>
  );
}

export function Card(props: { children: React.ReactNode; gap?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: theme.border,
        padding: 14,
        gap: props.gap ?? 10,
        boxShadow: `0 1px 2px ${theme.shadow}`,
      }}
    >
      {props.children}
    </View>
  );
}

export function Button(props: {
  title: string;
  onPress: () => void;
  filled?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const backgroundColor = props.filled
    ? props.danger
      ? theme.red
      : theme.blue
    : theme.elevated;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        borderCurve: "continuous",
        paddingHorizontal: 14,
        paddingVertical: 11,
        backgroundColor,
        opacity: props.disabled ? 0.45 : pressed ? 0.72 : 1,
      })}
    >
      <Text style={{ color: props.filled ? theme.blueText : theme.text, fontWeight: "800" }}>
        {props.title}
      </Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string; minHeight?: number }) {
  const theme = useTheme();
  const { label, minHeight, multiline, style, ...inputProps } = props;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.text, fontWeight: "700" }}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={theme.mutedText}
        selectionColor={theme.blue}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          {
            minHeight: minHeight ?? 48,
            borderRadius: 12,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: theme.border,
            padding: 13,
            backgroundColor: theme.surface,
            color: theme.text,
            fontSize: 16,
            lineHeight: 22,
          },
          style,
        ]}
      />
    </View>
  );
}

export function Pill(props: { label: string; active?: boolean; tone?: "blue" | "green" | "gray" }) {
  const theme = useTheme();
  const activeColor = props.tone === "green" ? theme.green : props.tone === "blue" ? theme.blue : theme.text;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: props.active ? activeColor : theme.elevated,
      }}
    >
      <Text style={{ color: props.active ? theme.blueText : theme.secondaryText, fontSize: 12, fontWeight: "800" }}>
        {props.label}
      </Text>
    </View>
  );
}

export function EmptyState(props: { title: string; message: string; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Card gap={8}>
      <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
        {props.title}
      </Text>
      <Text selectable style={{ color: theme.secondaryText, lineHeight: 20 }}>
        {props.message}
      </Text>
      {props.action}
    </Card>
  );
}
