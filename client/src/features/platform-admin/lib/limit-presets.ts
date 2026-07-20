// Human-friendly presets for the "Edit limits" dialog on the platform-admin
// usage tab. Tier codes align with the plan codes seeded by
// scripts/seed-plans.ts (starter/growth/enterprise) so `planTier` stays a
// meaningful label even though it's stored as a free-text column.

export type PresetKey = "starter" | "growth" | "enterprise" | "unlimited" | "custom";

export interface LimitPreset {
  key: PresetKey;
  label: string;
  /** planTier value applied when this preset is selected. */
  planTier: string;
  monthlyAiTokenLimit: number | null;
  monthlyAiMessageLimit: number | null;
  monthlySendsevenMsgLimit: number | null;
  /** Short plain-language blurb shown on the preset card. */
  description: string;
}

/** Rule-of-thumb conversion used only for the "≈ N AI replies/mo" helper copy. */
export const TOKENS_PER_AI_REPLY = 1500;

export const LIMIT_PRESETS: LimitPreset[] = [
  {
    key: "starter",
    label: "Starter",
    planTier: "starter",
    monthlyAiTokenLimit: 1_000_000,
    monthlyAiMessageLimit: 1_000,
    monthlySendsevenMsgLimit: 1_000,
    description: "Good for a single small team getting started with AI.",
  },
  {
    key: "growth",
    label: "Growth",
    planTier: "growth",
    monthlyAiTokenLimit: 5_000_000,
    monthlyAiMessageLimit: 5_000,
    monthlySendsevenMsgLimit: 5_000,
    description: "Fits most active organizations with regular AI + messaging use.",
  },
  {
    key: "enterprise",
    label: "Enterprise",
    planTier: "enterprise",
    monthlyAiTokenLimit: 20_000_000,
    monthlyAiMessageLimit: 20_000,
    monthlySendsevenMsgLimit: 20_000,
    description: "High-volume orgs that need generous headroom every month.",
  },
  {
    key: "unlimited",
    label: "Unlimited",
    planTier: "unlimited",
    monthlyAiTokenLimit: null,
    monthlyAiMessageLimit: null,
    monthlySendsevenMsgLimit: null,
    description: "No monthly caps on AI usage or SendSeven messages.",
  },
];

export const CUSTOM_PRESET: LimitPreset = {
  key: "custom",
  label: "Custom",
  planTier: "custom",
  monthlyAiTokenLimit: null,
  monthlyAiMessageLimit: null,
  monthlySendsevenMsgLimit: null,
  description: "Set your own AI token, AI message, and SendSeven message limits.",
};

/** ≈ how many AI replies a token budget covers, using the rule-of-thumb conversion. */
export function estimateAiReplies(tokenLimit: number | null): number | null {
  if (tokenLimit === null) return null;
  return Math.round(tokenLimit / TOKENS_PER_AI_REPLY);
}

/**
 * Determine which preset (if any) matches the given limit values exactly.
 * Falls back to "custom" when nothing matches — used both to highlight the
 * right card on open and to re-detect after manual edits.
 */
export function detectPreset(values: {
  monthlyAiTokenLimit: number | null;
  monthlyAiMessageLimit: number | null;
  monthlySendsevenMsgLimit: number | null;
}): PresetKey {
  const match = LIMIT_PRESETS.find(
    (p) =>
      p.monthlyAiTokenLimit === values.monthlyAiTokenLimit &&
      p.monthlyAiMessageLimit === values.monthlyAiMessageLimit &&
      p.monthlySendsevenMsgLimit === values.monthlySendsevenMsgLimit,
  );
  return match?.key ?? "custom";
}
