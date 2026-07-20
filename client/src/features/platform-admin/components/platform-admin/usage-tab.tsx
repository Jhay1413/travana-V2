import { useEffect, useState } from "react";
import { Loader2, Gauge, Pencil, History } from "lucide-react";
import { useAdminOrgUsage, useAdminOrgUsageHistory } from "@/hooks/queries";
import { useUpdateUsageLimits } from "@/hooks/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMicrosAsUsd, formatCount, usagePct } from "@/lib/usage-format";
import type { EnforcementMode, OrgUsageLimitsDto } from "@/features/platform-admin/api/platform-admin.api";

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

  const [planTier, setPlanTier]                 = useState(limits?.planTier ?? "starter");
  const [aiTokenLimit, setAiTokenLimit]         = useState(limits?.monthlyAiTokenLimit != null ? String(limits.monthlyAiTokenLimit) : "");
  const [aiMessageLimit, setAiMessageLimit]     = useState(limits?.monthlyAiMessageLimit != null ? String(limits.monthlyAiMessageLimit) : "");
  const [sendsevenLimit, setSendsevenLimit]     = useState(limits?.monthlySendsevenMsgLimit != null ? String(limits.monthlySendsevenMsgLimit) : "");
  const [aiEnabled, setAiEnabled]               = useState(limits?.aiLimitsEnabled ?? true);
  const [sendsevenEnabled, setSendsevenEnabled] = useState(limits?.sendsevenLimitsEnabled ?? true);
  const [enforcementMode, setEnforcementMode]   = useState<EnforcementMode>(limits?.enforcementMode ?? "monitor");
  const [warnThreshold, setWarnThreshold]       = useState(String(limits?.warnThresholdPct ?? 80));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlanTier(limits?.planTier ?? "starter");
    setAiTokenLimit(limits?.monthlyAiTokenLimit != null ? String(limits.monthlyAiTokenLimit) : "");
    setAiMessageLimit(limits?.monthlyAiMessageLimit != null ? String(limits.monthlyAiMessageLimit) : "");
    setSendsevenLimit(limits?.monthlySendsevenMsgLimit != null ? String(limits.monthlySendsevenMsgLimit) : "");
    setAiEnabled(limits?.aiLimitsEnabled ?? true);
    setSendsevenEnabled(limits?.sendsevenLimitsEnabled ?? true);
    setEnforcementMode(limits?.enforcementMode ?? "monitor");
    setWarnThreshold(String(limits?.warnThresholdPct ?? 80));
    setError(null);
  }, [open, limits]);

  // Empty input = unlimited (null). Otherwise must be a non-negative integer.
  const parseNullableLimit = (raw: string): number | null | "invalid" => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0) return "invalid";
    return n;
  };

  const handleSave = async () => {
    const aiTokens     = parseNullableLimit(aiTokenLimit);
    const aiMessages   = parseNullableLimit(aiMessageLimit);
    const sendseven    = parseNullableLimit(sendsevenLimit);
    const warnPct      = Number(warnThreshold);

    if (aiTokens === "invalid" || aiMessages === "invalid" || sendseven === "invalid") {
      setError("Limits must be a non-negative whole number, or blank for unlimited.");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-usage-limits">
        <DialogHeader>
          <DialogTitle>Edit usage limits — {orgName}</DialogTitle>
          <DialogDescription>
            Monthly AI + SendSeven quotas for this organization. Leave a limit blank for unlimited.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Plan tier</label>
            <Input value={planTier} onChange={(e) => setPlanTier(e.target.value)} data-testid="input-plan-tier" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Monthly AI token limit</label>
              <Input type="number" min={0} placeholder="Unlimited" value={aiTokenLimit} onChange={(e) => setAiTokenLimit(e.target.value)} data-testid="input-ai-token-limit" />
            </div>
            <div>
              <label className="text-sm font-medium">Monthly AI message limit</label>
              <Input type="number" min={0} placeholder="Unlimited" value={aiMessageLimit} onChange={(e) => setAiMessageLimit(e.target.value)} data-testid="input-ai-message-limit" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Monthly SendSeven message limit</label>
            <Input type="number" min={0} placeholder="Unlimited" value={sendsevenLimit} onChange={(e) => setSendsevenLimit(e.target.value)} data-testid="input-sendseven-limit" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Enforcement mode</label>
              <Select value={enforcementMode} onValueChange={(v) => setEnforcementMode(v as EnforcementMode)}>
                <SelectTrigger data-testid="select-enforcement-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monitor">Monitor</SelectItem>
                  <SelectItem value="enforce">Enforce</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Warn threshold (%)</label>
              <Input type="number" min={1} max={100} value={warnThreshold} onChange={(e) => setWarnThreshold(e.target.value)} data-testid="input-warn-threshold" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="rounded" data-testid="checkbox-ai-limits-enabled" />
              AI limit enforcement enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendsevenEnabled} onChange={(e) => setSendsevenEnabled(e.target.checked)} className="rounded" data-testid="checkbox-sendseven-limits-enabled" />
              SendSeven limit enforcement enabled
            </label>
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
