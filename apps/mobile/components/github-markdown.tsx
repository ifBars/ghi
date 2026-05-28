import { useMemo } from "react";
import { Linking, Text, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import Markdown, { type RenderRules } from "react-native-markdown-display";
import { useTheme } from "@/components/ui";

type MarkdownStyles = Record<string, TextStyle | ViewStyle | ImageStyle>;

export function GitHubMarkdown(props: { children: string; baseUrl?: string; emptyText?: string }) {
  const theme = useTheme();
  const markdown = normalizeGitHubMarkdown(props.children);
  const styles = useMemo<MarkdownStyles>(
    () => ({
      body: {
        color: markdown ? theme.secondaryText : theme.mutedText,
        fontSize: 16,
        lineHeight: 23,
      },
      heading1: {
        color: theme.text,
        fontSize: 24,
        lineHeight: 30,
        fontWeight: "900",
        marginTop: 16,
        marginBottom: 8,
      },
      heading2: {
        color: theme.text,
        fontSize: 20,
        lineHeight: 26,
        fontWeight: "900",
        marginTop: 16,
        marginBottom: 8,
      },
      heading3: {
        color: theme.text,
        fontSize: 17,
        lineHeight: 23,
        fontWeight: "900",
        marginTop: 12,
        marginBottom: 6,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 10,
      },
      text: {
        color: theme.secondaryText,
      },
      strong: {
        color: theme.text,
        fontWeight: "900",
      },
      em: {
        color: theme.secondaryText,
        fontStyle: "italic",
      },
      link: {
        color: theme.blue,
        fontWeight: "700",
      },
      blockquote: {
        backgroundColor: theme.elevated,
        borderLeftColor: theme.border,
        borderLeftWidth: 4,
        borderRadius: 8,
        borderCurve: "continuous",
        marginVertical: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
      },
      code_inline: {
        backgroundColor: theme.elevated,
        color: theme.text,
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 2,
        fontFamily: "monospace",
        fontSize: 14,
      },
      code_block: {
        backgroundColor: theme.elevated,
        color: theme.text,
        borderRadius: 10,
        borderCurve: "continuous",
        padding: 12,
        fontFamily: "monospace",
        fontSize: 14,
        lineHeight: 20,
      },
      fence: {
        backgroundColor: theme.elevated,
        color: theme.text,
        borderRadius: 10,
        borderCurve: "continuous",
        padding: 12,
        fontFamily: "monospace",
        fontSize: 14,
        lineHeight: 20,
      },
      bullet_list: {
        marginBottom: 10,
      },
      ordered_list: {
        marginBottom: 10,
      },
      bullet_list_icon: {
        color: theme.secondaryText,
      },
      ordered_list_icon: {
        color: theme.secondaryText,
      },
      list_item: {
        marginBottom: 4,
      },
      hr: {
        backgroundColor: theme.border,
        height: 1,
        marginVertical: 14,
      },
      table: {
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 8,
        overflow: "hidden",
      },
      th: {
        backgroundColor: theme.elevated,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 6,
      },
      td: {
        borderColor: theme.border,
        borderWidth: 1,
        padding: 6,
      },
    }),
    [markdown, theme],
  );

  const rules = useMemo<RenderRules>(
    () => ({
      s: (node, children, _parent, nodeStyles) => (
        <Text key={node.key} style={nodeStyles.s} selectable>
          {children}
        </Text>
      ),
    }),
    [],
  );

  return (
    <Markdown
      mergeStyle
      rules={rules}
      style={styles}
      onLinkPress={(url) => {
        void openMarkdownLink(url, props.baseUrl);
        return false;
      }}
    >
      {markdown || props.emptyText || "No description provided."}
    </Markdown>
  );
}

function normalizeGitHubMarkdown(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<details>\s*<summary>([\s\S]*?)<\/summary>/gi, "\n\n**$1**\n\n")
    .replace(/<\/details>/gi, "")
    .replace(/<blockquote>/gi, "\n> ")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<\/?p>/gi, "\n")
    .trim();
}

async function openMarkdownLink(url: string, baseUrl?: string) {
  const resolvedUrl = resolveMarkdownUrl(url, baseUrl);
  if (!resolvedUrl) {
    return;
  }
  await Linking.openURL(resolvedUrl);
}

function resolveMarkdownUrl(url: string, baseUrl?: string) {
  if (/^[a-z][a-z\d+\-.]*:/i.test(url)) {
    return url;
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return `https://github.com${url}`;
  }

  if (baseUrl) {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return undefined;
    }
  }

  return undefined;
}
