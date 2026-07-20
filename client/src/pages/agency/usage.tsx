import { AlertTriangle, Gauge, History, MessageCircle } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useOrgUsageSummary, useOrgUsageHistory } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { formatCount, usagePct } from "@/lib/usage-format";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { PageLoading } from "@/features/organization/components/agency/PageLoading";

const formatPeriod = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

export default function AgencyUsagePage() {
  const { can } = useRole();
  const allowed = can("admin", "billing");

  const { data: summary, isLoading: summaryLoading } = useOrgUsageSummary();
  const { data: history, isLoading: historyLoading } = useOrgUsageHistory(6);

  if (!allowed) return <OwnerOnlyGate />;
  if (summaryLoading || !summary) return <PageLoading />;

  const limits = summary.limits;
  const aiTokenPct    = usagePct(summary.ai.totalTokens, limits?.monthlyAiTokenLimit ?? null);
  const sendsevenPct  = usagePct(summary.sendseven.sentCount, limits?.monthlySendsevenMsgLimit ?? null);
  const aiWarn        = summary.aiUsageCheck.warnThresholdCrossed;
  const sendsevenWarn = summary.sendsevenUsageCheck.warnThresholdCrossed;
  const aiOver        = !summary.aiUsageCheck.allowed;
  const sendsevenOver = !summary.sendsevenUsageCheck.allowed;
  const manualSent    = summary.sendseven.sentCount - summary.sendseven.aiSentCount;
  const showBanner    = aiWarn || sendsevenWarn || aiOver || sendsevenOver;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-5 w-5 text-black/60 dark:text-white/60" />
        <div>
          <div className="text-lg font-semibold">AI + SendSeven usage</div>
          <div className="text-sm text-black/50 dark:text-white/50">
            Your organization's usage for {formatPeriod(summary.ai.periodStart)}.
          </div>
        </div>
      </div>

      {showBanner && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
          data-testid="banner-usage-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800 dark:text-amber-400">
            {aiOver || sendsevenOver
              ? "You're over your monthly AI/SendSeven allowance. Usage is currently informational only — nothing has been blocked."
              : "You're approaching your monthly AI/SendSeven allowance."}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <UsageCard
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="AI tokens"
          accent={aiOver ? "over" : aiWarn ? "warn" : undefined}
        >
          <div className="flex items-end gap-2">
            <div className="text-3xl font-semibold" data-testid="text-ai-tokens">
              {formatCount(summary.ai.totalTokens)}
            </div>
            <div className="pb-1 text-sm text-black/50 dark:text-white/50">
              / {limits?.monthlyAiTokenLimit != null ? formatCount(limits.monthlyAiTokenLimit) : "Unlimited"}
            </div>
          </div>
          {limits?.monthlyAiTokenLimit != null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  aiOver ? "bg-red-500" : aiWarn ? "bg-amber-500" : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, aiTokenPct)}%` }}
              />
            </div>
          )}
          <div className="mt-2 text-xs text-black/50 dark:text-white/50" data-testid="text-ai-messages">
            {formatCount(summary.ai.messageCount)} AI messages this period
          </div>
          {aiOver && <div className="mt-2 text-xs font-medium text-amber-700">Approaching/over your monthly AI allowance</div>}
          {!aiOver && aiWarn && <div className="mt-2 text-xs font-medium text-amber-600">Approaching your monthly AI allowance</div>}
        </UsageCard>

        <UsageCard
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          label="SendSeven messages"
          accent={sendsevenOver ? "over" : sendsevenWarn ? "warn" : undefined}
        >
          <div className="flex items-end gap-2">
            <div className="text-3xl font-semibold" data-testid="text-sendseven-sent">
              {formatCount(summary.sendseven.sentCount)}
            </div>
            <div className="pb-1 text-sm text-black/50 dark:text-white/50">
              / {limits?.monthlySendsevenMsgLimit != null ? formatCount(limits.monthlySendsevenMsgLimit) : "Unlimited"}
            </div>
          </div>
          {limits?.monthlySendsevenMsgLimit != null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  sendsevenOver ? "bg-red-500" : sendsevenWarn ? "bg-amber-500" : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, sendsevenPct)}%` }}
              />
            </div>
          )}
          <div className="mt-2 text-xs text-black/50 dark:text-white/50" data-testid="text-sendseven-split">
            {formatCount(summary.sendseven.aiSentCount)} by AI / {formatCount(manualSent)} manual
          </div>
          {sendsevenOver && <div className="mt-2 text-xs font-medium text-amber-700">Approaching/over your monthly SendSeven allowance</div>}
          {!sendsevenOver && sendsevenWarn && <div className="mt-2 text-xs font-medium text-amber-600">Approaching your monthly SendSeven allowance</div>}
        </UsageCard>
      </div>

      {!historyLoading && history && history.ai.length > 0 && (
        <UsageHistoryTable history={history} />
      )}
    </div>
  );
}

function UsageCard({
  icon,
  label,
  accent,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: "warn" | "over";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        accent === "over"
          ? "border-amber-500/40 bg-amber-500/5"
          : accent === "warn"
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5",
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
        {icon}
        {label}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function UsageHistoryTable({
  history,
}: {
  history: { ai: { periodStart: string; totalTokens: number; messageCount: number }[]; sendseven: { periodStart: string; sentCount: number; aiSentCount: number }[] };
}) {
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
      <table className="w-full text-sm" data-testid="table-usage-history">
        <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
          <tr>
            <th className="px-4 py-3 text-left">Month</th>
            <th className="px-4 py-3 text-left">AI tokens</th>
            <th className="px-4 py-3 text-left">AI messages</th>
            <th className="px-4 py-3 text-left">SendSeven sent</th>
            <th className="px-4 py-3 text-left">SendSeven AI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ai, sendseven }) => (
            <tr
              key={ai.periodStart}
              className="border-b border-black/5 last:border-0 dark:border-white/10"
              data-testid={`usage-history-row-${ai.periodStart}`}
            >
              <td className="px-4 py-3 text-xs">{formatPeriod(ai.periodStart)}</td>
              <td className="px-4 py-3">{formatCount(ai.totalTokens)}</td>
              <td className="px-4 py-3">{formatCount(ai.messageCount)}</td>
              <td className="px-4 py-3">{formatCount(sendseven.sentCount)}</td>
              <td className="px-4 py-3">{formatCount(sendseven.aiSentCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
