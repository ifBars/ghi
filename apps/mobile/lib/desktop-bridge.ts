import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { IntakeKind, MobileAttachment } from "@/lib/drafts";

const BRIDGE_URL_KEY = "ghi.desktopBridge.url.v1";
const BRIDGE_TOKEN_KEY = "ghi.desktopBridge.token.v1";

export type DesktopBridgeConfig = {
  url: string;
  token: string;
};

export type DesktopBridgeHealth = {
  ok: boolean;
  repo: string | null;
  root: string;
  branch: string | null;
  commit: string | null;
  dirty: boolean;
};

export type DesktopBridgeIssueResult = {
  ok: boolean;
  accepted?: boolean;
  repo?: string | null;
  job?: {
    id: string;
    status: string;
    createdAt: string;
  };
  createdIssue?: { number: number | null; url: string } | null;
  payload?: { title: string; body: string };
  log?: string;
  error?: string;
};

export async function loadDesktopBridge(): Promise<DesktopBridgeConfig | null> {
  const url = await AsyncStorage.getItem(BRIDGE_URL_KEY);
  const token = process.env.EXPO_OS === "web"
    ? await AsyncStorage.getItem(BRIDGE_TOKEN_KEY)
    : await SecureStore.getItemAsync(BRIDGE_TOKEN_KEY);

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export async function saveDesktopBridge(config: DesktopBridgeConfig): Promise<void> {
  await AsyncStorage.setItem(BRIDGE_URL_KEY, normalizeBridgeUrl(config.url));
  if (process.env.EXPO_OS === "web") {
    await AsyncStorage.setItem(BRIDGE_TOKEN_KEY, config.token.trim());
    return;
  }
  await SecureStore.setItemAsync(BRIDGE_TOKEN_KEY, config.token.trim());
}

export async function clearDesktopBridge(): Promise<void> {
  await AsyncStorage.removeItem(BRIDGE_URL_KEY);
  if (process.env.EXPO_OS === "web") {
    await AsyncStorage.removeItem(BRIDGE_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(BRIDGE_TOKEN_KEY);
}

export async function testDesktopBridge(config: DesktopBridgeConfig): Promise<DesktopBridgeHealth> {
  const response = await fetch(`${normalizeBridgeUrl(config.url)}/health`, {
    headers: bridgeHeaders(config.token),
  });
  return readBridgeResponse<DesktopBridgeHealth>(response);
}

export async function sendCaptureToDesktopBridge(config: DesktopBridgeConfig, input: {
  repo: string;
  kind: IntakeKind;
  report: string;
  context: string;
  attachments?: MobileAttachment[];
  dryRun?: boolean;
}): Promise<DesktopBridgeIssueResult> {
  const response = await fetch(`${normalizeBridgeUrl(config.url)}/issues`, {
    method: "POST",
    headers: {
      ...bridgeHeaders(config.token),
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return readBridgeResponse<DesktopBridgeIssueResult>(response);
}

export function parseDesktopBridgePairingUrl(value: string): DesktopBridgeConfig {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "ghi:" || parsed.hostname !== "pair") {
    throw new Error("QR code is not a ghi desktop pairing code.");
  }

  const url = parsed.searchParams.get("url");
  const token = parsed.searchParams.get("token");
  if (!url || !token) {
    throw new Error("Pairing code is missing a URL or token.");
  }

  return {
    url: normalizeBridgeUrl(url),
    token,
  };
}

function bridgeHeaders(token: string) {
  return {
    authorization: `Bearer ${token.trim()}`,
    "x-ghi-token": token.trim(),
  };
}

async function readBridgeResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? JSON.parse(text) as T & { error?: string } : {} as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || `Desktop bridge returned ${response.status}`);
  }
  return body;
}

function normalizeBridgeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
