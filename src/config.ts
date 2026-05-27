import { creationModeSchema, type CreationMode, type GhiConfig } from "./domain.js";

export const defaultConfig: GhiConfig = {
  creationMode: "immediate_draft",
  aiDraftLabel: "ai-draft",
  triageLabelCandidates: ["needs-triage", "triage", "needs review", "status: triage"],
};

export type ConfigOverrides = {
  creationMode?: string;
};

export function resolveCreationMode(overrides: ConfigOverrides = {}): CreationMode {
  if (!overrides.creationMode) {
    return defaultConfig.creationMode;
  }

  return creationModeSchema.parse(overrides.creationMode);
}

export function loadConfig(overrides: ConfigOverrides = {}): GhiConfig {
  return {
    ...defaultConfig,
    creationMode: resolveCreationMode(overrides),
  };
}
