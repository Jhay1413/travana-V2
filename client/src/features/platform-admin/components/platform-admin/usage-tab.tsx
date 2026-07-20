import { useEffect, useMemo, useState } from "react";
import { Loader2, Gauge, Pencil, History, ChevronDown, ChevronRight } from "lucide-react";
import { useAdminOrgUsage, useAdminOrgUsageHistory } from "@/hooks/queries";
import { useUpdateUsageLimits } from "@/hooks/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMicrosAsUsd, formatCount, usagePct } from "@/lib/usage-format";
import type { EnforcementMode, OrgUsageLimitsDto } from "@/features/platform-admin/api/platform-admin.api";
import {
  LIMIT_PRESETS,
  CUSTOM_PRESET,
  detectPreset,
  estimateAiReplies,
  type LimitPreset,
  type PresetKey,
} from "@/features/platform-admin/lib/limit-presets";

const ALL_PRESET_CARDS: LimitPreset[] = [...LIMIT_PRESETS, CUSTOM_PRESET];

/** Displayed value for a possibly-unlimited limit. */
const formatLimitValue = (n: number | null) => (n === null ? "Unlimited" : formatCount(n));

/** Free-typed "millions of tokens" text → raw token count. Empty = unlimited. */
const parseMillionsToTokens = (raw: string): number | null | "invalid" => {
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return Math.round(n * 1_000_000);
};

/** Raw token count → the canonical "millions" text shown in the input. */
const formatTokensAsMillionsText = (tokens: number | null): string => {
  if (tokens === null) return "";
  const millions = tokens / 1_000_000;
  return (Math.round(millions * 1000) / 1000).toString();
};

/** Free-typed count text (with optional commas) → integer. Empty = unlimited. */
const parseCountInput = (raw: string): number | null | "invalid" => {
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return "invalid";
  return n;
};

const formatCountForInput = (n: number | null): string => (n === null ? "" : formatCount(n));

/** Card summary lines for a fixed (non-custom) preset. */
const presetSummaryLines = (preset: LimitPreset): { tokensLine: string; otherLine: string } => {
  const replies = estimateAiReplies(preset.monthlyAiTokenLimit);
  const tokensLine =
    preset.monthlyAiTokenLimit === null
      ? "Unlimited AI tokens"
      : `${formatCount(preset.monthlyAiTokenLimit)} AI tokens ≈ ${formatCount(replies ?? 0)} AI replies/mo`;
  const otherLine = `${formatLimitValue(preset.monthlyAiMessageLimit)} AI messages · ${formatLimitValue(
    preset.monthlySendsevenMsgLimit,
  )} SendSeven msgs/mo`;
  return { tokensLine, otherLine };
};

const formatPeriod = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

export function UsageTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { data: summary, isLoading } = useAdminOrgUsage(orgId);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || !summary) {
    return <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>;
  }

  const limits = summary.limits;
  const aiTokenPct       = usagePct(summary.ai.totalTokens, limits?.monthlyAiTokenLimit ?? null);
  const sendsevenPct     = usagePct(summary.sendseven.sentCount, limits?.monthlySendsevenMsgLimit ?? null);
  const aiWarn           = summary.aiUsageCheck.warnThresholdCrossed;
  const sendsevenWarn    = summary.sendsevenUsageCheck.warnThresholdCrossed;
  const aiBlocked        = !summary.aiUsageCheck.allowed;
  const sendsevenBlocked = !summary.sendsevenUsageCheck.allowed;
  const manualSent       = summary.sendseven.sentCount - summary.sendseven.aiSentCount;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          label="AI tokens"
          hint={formatPeriod(summary.ai.periodStart)}
          accent={aiBlocked ? "over" : aiWarn ? "warn" : undefined}
        >
          <div className="flex items-end gap-2">
            <div className="text-3xl font-semibold" data-testid="text-ai-tokens">{formatCount(summary.ai.totalTokens)}</div>
            <div className="pb-1 text-sm text-black/50 dark:text-white/50">
              / {limits?.monthlyAiTokenLimit != null ? formatCount(limits.monthlyAiTokenLimit) : "∞"}
            </div>
          </div>
          {limits?.monthlyAiTokenLimit != null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  aiBlocked ? "bg-red-500" : aiWarn ? "bg-amber-500" : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, aiTokenPct)}%` }}
              />
            </div>
          )}
          <div className="mt-2 text-xs text-black/50 dark:text-white/50">
            {formatCount(summary.ai.messageCount)} AI messages this period
          </div>
          {aiBlocked && <div className="mt-2 text-xs font-medium text-red-600">Over limit — enforcement active</div>}
          {!aiBlocked && aiWarn && <div className="mt-2 text-xs font-medium text-amber-600">Approaching limit</div>}
        </SummaryCard>

        <SummaryCard label="Estimated AI cost" hint="This period">
          <div className="text-3xl font-semibold" data-testid="text-ai-cost">{formatMicrosAsUsd(summary.ai.costMicros)}</div>
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">
            Enforcement: <span className="font-medium">{limits?.enforcementMode ?? "monitor"}</span>
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">
            Plan tier: <span className="font-medium">{limits?.planTier ?? "starter"}</span>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditOpen(true)} data-testid="button-edit-usage-limits">
            <Pencil className="mr-1 h-3 w-3" /> Edit limits
          </Button>
        </SummaryCard>

        <SummaryCard
          label="SendSeven messages"
          hint={formatPeriod(summary.sendseven.periodStart)}
          accent={sendsevenBlocked ? "over" : sendsevenWarn ? "warn" : undefined}
        >
          <div className="flex items-end gap-2">
            <div className="text-3xl font-semibold" data-testid="text-sendseven-sent">{formatCount(summary.sendseven.sentCount)}</div>
            <div className="pb-1 text-sm text-black/50 dark:text-white/50">
              / {limits?.monthlySendsevenMsgLimit != null ? formatCount(limits.monthlySendsevenMsgLimit) : "∞"}
            </div>
          </div>
          {limits?.monthlySendsevenMsgLimit != null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  sendsevenBlocked ? "bg-red-500" : sendsevenWarn ? "bg-amber-500" : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, sendsevenPct)}%` }}
              />
            </div>
          )}
          <div className="mt-2 text-xs text-black/50 dark:text-white/50">
            {formatCount(summary.sendseven.aiSentCount)} by AI / {formatCount(manualSent)} manual
          </div>
          {sendsevenBlocked && <div className="mt-2 text-xs font-medium text-red-600">Over limit — enforcement active</div>}
          {!sendsevenBlocked && sendsevenWarn && <div className="mt-2 text-xs font-medium text-amber-600">Approaching limit</div>}
        </SummaryCard>
      </div>

      <UsageHistoryPanel orgId={orgId} />

      <EditLimitsDialog
        orgId={orgId}
        orgName={orgName}
        limits={limits}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

function SummaryCard({
  label,
  hint,
  accent,
  children,
}: {
  label: string;
  hint?: string;
  accent?: "warn" | "over";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        accent === "over"
          ? "border-red-500/40 bg-red-500/5"
          : accent === "warn"
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
          <Gauge className="h-3.5 w-3.5" />
          {label}
        </div>
        {hint && <div className="text-xs text-black/40 dark:text-white/40">{hint}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function UsageHistoryPanel({ orgId }: { orgId: string }) {
  const { data: history, isLoading } = useAdminOrgUsageHistory(orgId, 6);

  if (isLoading) {
    return <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>;
  }
  if (!history || history.ai.length === 0) {
    return null;
  }

  // Merge AI + SendSeven rows by periodStart for a single table.
  const sendsevenByPeriod = new Map(history.sendseven.map((s) => [s.periodStart, s]));
  const rows = history.ai.map((ai) => ({
    ai,
    sendseven: sendsevenByPeriod.get(ai.periodStart) ?? { periodStart: ai.periodStart, sentCount: 0, aiSentCount: 0 },
  }));

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-2 border-b border-black/5 p-4 dark:border-white/10">
        <History className="h-4 w-4 text-black/60 dark:text-white/60" />
        <div className="font-medium">Monthly history</div>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
          <tr>
            <th className="px-4 py-3 text-left">Month</th>
            <th className="px-4 py-3 text-left">AI tokens</th>
            <th className="px-4 py-3 text-left">AI messages</th>
            <th className="px-4 py-3 text-left">Est. cost</th>
            <th className="px-4 py-3 text-left">SendSeven sent</th>
            <th className="px-4 py-3 text-left">SendSeven AI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ai, sendseven }) => (
            <tr key={ai.periodStart} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`usage-history-row-${ai.periodStart}`}>
              <td className="px-4 py-3 text-xs">{formatPeriod(ai.periodStart)}</td>
              <td className="px-4 py-3">{formatCount(ai.totalTokens)}</td>
              <td className="px-4 py-3">{formatCount(ai.messageCount)}</td>
              <td className="px-4 py-3">{formatMicrosAsUsd(ai.costMicros)}</td>
              <td className="px-4 py-3">{formatCount(sendseven.sentCount)}</td>
              <td className="px-4 py-3">{formatCount(sendseven.aiSentCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditLimitsDialog({
  orgId,
  orgName,
  limits,
  open,
  onOpenChange,
}: {
  orgId: string;
  orgName: string;
  limits: OrgUsageLimitsDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateUsageLimits();

  const initialValues = {
    monthlyAiTokenLimit: limits?.monthlyAiTokenLimit ?? null,
    monthlyAiMessageLimit: limits?.monthlyAiMessageLimit ?? null,
    monthlySendsevenMsgLimit: limits?.monthlySendsevenMsgLimit ?? null,
  };

  const [presetKey, setPresetKey]               = useState<PresetKey>(() => detectPreset(initialValues));
  const [planTier, setPlanTier]                 = useState(limits?.planTier ?? "starter");
  const [customAiTokenText, setCustomAiTokenText]         = useState(formatTokensAsMillionsText(initialValues.monthlyAiTokenLimit));
  const [customAiMessageText, setCustomAiMessageText]     = useState(formatCountForInput(initialValues.monthlyAiMessageLimit));
  const [customSendsevenText, setCustomSendsevenText]     = useState(formatCountForInput(initialValues.monthlySendsevenMsgLimit));
  const [aiEnabled, setAiEnabled]               = useState(limits?.aiLimitsEnabled ?? true);
  const [sendsevenEnabled, setSendsevenEnabled] = useState(limits?.sendsevenLimitsEnabled ?? true);
  const [enforcementMode, setEnforcementMode]   = useState<EnforcementMode>(limits?.enforcementMode ?? "monitor");
  const [warnThreshold, setWarnThreshold]       = useState(String(limits?.warnThresholdPct ?? 80));
  const [advancedOpen, setAdvancedOpen]         = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const values = {
      monthlyAiTokenLimit: limits?.monthlyAiTokenLimit ?? null,
      monthlyAiMessageLimit: limits?.monthlyAiMessageLimit ?? null,
      monthlySendsevenMsgLimit: limits?.monthlySendsevenMsgLimit ?? null,
    };
    setPresetKey(detectPreset(values));
    setPlanTier(limits?.planTier ?? "starter");
    setCustomAiTokenText(formatTokensAsMillionsText(values.monthlyAiTokenLimit));
    setCustomAiMessageText(formatCountForInput(values.monthlyAiMessageLimit));
    setCustomSendsevenText(formatCountForInput(values.monthlySendsevenMsgLimit));
    setAiEnabled(limits?.aiLimitsEnabled ?? true);
    setSendsevenEnabled(limits?.sendsevenLimitsEnabled ?? true);
    setEnforcementMode(limits?.enforcementMode ?? "monitor");
    setWarnThreshold(String(limits?.warnThresholdPct ?? 80));
    setAdvancedOpen(false);
    setError(null);
  }, [open, limits]);

  const activePreset = presetKey !== "custom" ? LIMIT_PRESETS.find((p) => p.key === presetKey) ?? null : null;

  const handleSelectPreset = (key: string) => {
    const preset = ALL_PRESET_CARDS.find((p) => p.key === key);
    if (!preset) return;
    setPresetKey(preset.key);
    if (preset.key === "custom") {
      // Custom keeps whatever values/tier are already on the form — it just
      // unlocks manual editing rather than overwriting anything.
      return;
    }
    setPlanTier(preset.planTier);
    setCustomAiTokenText(formatTokensAsMillionsText(preset.monthlyAiTokenLimit));
    setCustomAiMessageText(formatCountForInput(preset.monthlyAiMessageLimit));
    setCustomSendsevenText(formatCountForInput(preset.monthlySendsevenMsgLimit));
  };

  // Live "≈ N AI replies/mo" helper text for the custom token field.
  const customTokenHelperText = useMemo(() => {
    const parsed = parseMillionsToTokens(customAiTokenText);
    if (parsed === "invalid") return "Enter a number, e.g. 5 for 5,000,000 tokens.";
    if (parsed === null) return "Unlimited — no cap on AI usage.";
    return `≈ ${formatCount(estimateAiReplies(parsed) ?? 0)} AI replies per month`;
  }, [customAiTokenText]);

  const handleSave = async () => {
    let aiTokens: number | null | "invalid";
    let aiMessages: number | null | "invalid";
    let sendseven: number | null | "invalid";

    if (activePreset) {
      aiTokens = activePreset.monthlyAiTokenLimit;
      aiMessages = activePreset.monthlyAiMessageLimit;
      sendseven = activePreset.monthlySendsevenMsgLimit;
    } else {
      aiTokens = parseMillionsToTokens(customAiTokenText);
      aiMessages = parseCountInput(customAiMessageText);
      sendseven = parseCountInput(customSendsevenText);
    }
    const warnPct = Number(warnThreshold);

    if (aiTokens === "invalid" || aiMessages === "invalid" || sendseven === "invalid") {
      setError("Limits must be a non-negative number, or blank for unlimited.");
      return;
    }
    if (!Number.isInteger(warnPct) || warnPct < 1 || warnPct > 100) {
      setError("Warn threshold must be a whole number between 1 and 100.");
      return;
    }
    if (!planTier.trim()) {
      setError("Plan tier is required.");
      return;
    }
    setError(null);

    try {
      await update.mutateAsync({
        orgId,
        patch: {
          planTier: planTier.trim(),
          monthlyAiTokenLimit: aiTokens,
          monthlyAiMessageLimit: aiMessages,
          monthlySendsevenMsgLimit: sendseven,
          aiLimitsEnabled: aiEnabled,
          sendsevenLimitsEnabled: sendsevenEnabled,
          enforcementMode,
          warnThresholdPct: warnPct,
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to update usage limits");
    }
  };

  // Summary sentence shown above Save — reflects exactly what will be sent.
  const summarySentence = useMemo(() => {
    const enforcementPhrase =
      enforcementMode === "monitor"
        ? "monitor only (no blocking)"
        : "enforced (AI features pause once the limit is reached)";

    if (activePreset) {
      if (activePreset.key === "unlimited") {
        return `Unlimited plan: no monthly caps on AI or SendSeven usage, ${enforcementPhrase}.`;
      }
      const replies = estimateAiReplies(activePreset.monthlyAiTokenLimit);
      return `${activePreset.label} plan: ~${formatCount(replies ?? 0)} AI replies and ${formatLimitValue(
        activePreset.monthlySendsevenMsgLimit,
      )} SendSeven messages/mo, ${enforcementPhrase}.`;
    }

    const parsedTokens = parseMillionsToTokens(customAiTokenText);
    const parsedSendseven = parseCountInput(customSendsevenText);
    const repliesText =
      parsedTokens === "invalid" ? "an unknown number of" : parsedTokens === null ? "unlimited" : `~${formatCount(estimateAiReplies(parsedTokens) ?? 0)}`;
    const sendsevenText =
      parsedSendseven === "invalid" ? "an unknown number of" : parsedSendseven === null ? "unlimited" : formatCount(parsedSendseven);
    return `Custom limits: ${repliesText} AI replies and ${sendsevenText} SendSeven messages/mo, ${enforcementPhrase}.`;
  }, [activePreset, enforcementMode, customAiTokenText, customSendsevenText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="dialog-edit-usage-limits">
        <DialogHeader>
          <DialogTitle>Edit usage limits — {orgName}</DialogTitle>
          <DialogDescription>
            Choose a plan preset or set custom monthly limits for AI and SendSeven usage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Plan preset</Label>
            <RadioGroup value={presetKey} onValueChange={handleSelectPreset} className="grid gap-2 sm:grid-cols-2">
              {ALL_PRESET_CARDS.map((preset) => {
                const selected = presetKey === preset.key;
                const lines = preset.key !== "custom" ? presetSummaryLines(preset) : null;
                return (
                  <label
                    key={preset.key}
                    htmlFor={`preset-${preset.key}`}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-black/10 hover:border-black/20 dark:border-white/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{preset.label}</span>
                      <RadioGroupItem value={preset.key} id={`preset-${preset.key}`} data-testid={`radio-preset-${preset.key}`} />
                    </div>
                    <p className="text-xs text-black/60 dark:text-white/60">{preset.description}</p>
                    {lines && (
                      <>
                        <p className="text-xs text-black/50 dark:text-white/50">{lines.tokensLine}</p>
                        <p className="text-xs text-black/50 dark:text-white/50">{lines.otherLine}</p>
                      </>
                    )}
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {presetKey === "custom" && (
            <div className="space-y-3 rounded-xl border border-black/10 p-3 dark:border-white/10">
              <div>
                <Label>Monthly AI tokens (millions)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="Unlimited"
                  value={customAiTokenText}
                  onChange={(e) => setCustomAiTokenText(e.target.value)}
                  onBlur={() => {
                    const parsed = parseMillionsToTokens(customAiTokenText);
                    if (parsed !== "invalid") setCustomAiTokenText(formatTokensAsMillionsText(parsed));
                  }}
                  data-testid="input-ai-token-limit"
                />
                <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                  e.g. "5" = 5,000,000 tokens. {customTokenHelperText} Leave blank for unlimited.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monthly AI messages</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="Unlimited"
                    value={customAiMessageText}
                    onChange={(e) => setCustomAiMessageText(e.target.value)}
                    onBlur={() => {
                      const parsed = parseCountInput(customAiMessageText);
                      if (parsed !== "invalid") setCustomAiMessageText(formatCountForInput(parsed));
                    }}
                    data-testid="input-ai-message-limit"
                  />
                </div>
                <div>
                  <Label>Monthly SendSeven messages</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="Unlimited"
                    value={customSendsevenText}
                    onChange={(e) => setCustomSendsevenText(e.target.value)}
                    onBlur={() => {
                      const parsed = parseCountInput(customSendsevenText);
                      if (parsed !== "invalid") setCustomSendsevenText(formatCountForInput(parsed));
                    }}
                    data-testid="input-sendseven-limit"
                  />
                </div>
              </div>
              <p className="text-xs text-black/50 dark:text-white/50">Leave a field blank for unlimited.</p>
            </div>
          )}

          <div>
            <Label className="mb-2 block">What happens at the limit?</Label>
            <RadioGroup
              value={enforcementMode}
              onValueChange={(v) => setEnforcementMode(v as EnforcementMode)}
              className="grid gap-2"
            >
              <label
                htmlFor="enforcement-monitor"
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors",
                  enforcementMode === "monitor"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-black/10 hover:border-black/20 dark:border-white/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="monitor" id="enforcement-monitor" data-testid="radio-enforcement-monitor" />
                  <span className="font-medium">Monitor only</span>
                </div>
                <p className="ml-6 text-xs text-black/60 dark:text-white/60">Track usage, never block anything.</p>
              </label>
              <label
                htmlFor="enforcement-enforce"
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors",
                  enforcementMode === "enforce"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-black/10 hover:border-black/20 dark:border-white/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="enforce" id="enforcement-enforce" data-testid="radio-enforcement-enforce" />
                  <span className="font-medium">Enforce</span>
                </div>
                <p className="ml-6 text-xs text-black/60 dark:text-white/60">
                  Pause AI features when the limit is reached.
                </p>
              </label>
            </RadioGroup>
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger
              className="flex items-center gap-1 text-sm font-medium text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
              data-testid="button-toggle-advanced"
            >
              {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Advanced settings
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              <div>
                <Label>Plan tier label</Label>
                <Input value={planTier} onChange={(e) => setPlanTier(e.target.value)} data-testid="input-plan-tier" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Count AI usage against limits</div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    Turn off to track AI usage without ever applying a limit.
                  </div>
                </div>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} data-testid="switch-ai-limits-enabled" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Count SendSeven messages against limits</div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    Turn off to track SendSeven sends without ever applying a limit.
                  </div>
                </div>
                <Switch
                  checked={sendsevenEnabled}
                  onCheckedChange={setSendsevenEnabled}
                  data-testid="switch-sendseven-limits-enabled"
                />
              </div>
              <div>
                <Label>Warn at __% of limit</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={warnThreshold}
                  onChange={(e) => setWarnThreshold(e.target.value)}
                  data-testid="input-warn-threshold"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div
            className="rounded-xl bg-black/[0.03] p-3 text-sm text-black/70 dark:bg-white/[0.05] dark:text-white/70"
            data-testid="text-limits-summary"
          >
            {summarySentence}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending} data-testid="button-save-usage-limits">
            {update.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
