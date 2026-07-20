import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Gauge, Loader2, Pencil, ExternalLink, CircleDollarSign } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useAdminUsageOverview, useAdminModelPricing } from "@/hooks/queries";
import { useUpsertModelPricing } from "@/hooks/mutations";
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
import type { OrgUsageOverviewRow, ModelPricingRow } from "@/features/platform-admin/api/platform-admin.api";

const MONTH_OPTIONS = [
  { value: "1",  label: "This month" },
  { value: "3",  label: "Last 3 months" },
  { value: "6",  label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
];

/** micros per 1,000,000 tokens → $ per 1,000,000 tokens. */
const formatPricePerMtok = (micros: number) => formatMicrosAsUsd(micros);

export default function PlatformAdminUsagePage() {
  const { role } = useRole();
  const allowed = role === "PlatformAdmin";
  const [, navigate] = useLocation();
  const [months, setMonths] = useState("1");

  const { data: rows = [], isLoading, isError, error } = useAdminUsageOverview(Number(months));

  if (!allowed) {
    return (
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
        <div className="font-semibold">Platform Admin only</div>
        <div className="text-sm text-black/60 dark:text-white/60">
          You don't have permission to view this page.
        </div>
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      tokens: acc.tokens + r.totalTokens,
      cost:   acc.cost + r.costMicros,
      sent:   acc.sent + r.sentCount,
    }),
    { tokens: 0, cost: 0, sent: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Gauge className="h-5 w-5 text-black/60 dark:text-white/60" />
          <div>
            <div className="text-lg font-semibold">AI + SendSeven usage</div>
            <div className="text-sm text-black/50 dark:text-white/50">
              Cross-org profit analysis — usage, cost and quota status by organization.
            </div>
          </div>
        </div>
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-overview-months">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total AI tokens" value={formatCount(totals.tokens)} testId="stat-total-tokens" />
        <Stat label="Total est. cost" value={formatMicrosAsUsd(totals.cost)} testId="stat-total-cost" />
        <Stat label="Total SendSeven sent" value={formatCount(totals.sent)} testId="stat-total-sent" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">AI tokens</th>
              <th className="px-4 py-3 text-left">AI messages</th>
              <th className="px-4 py-3 text-left">Est. cost</th>
              <th className="px-4 py-3 text-left">SendSeven sent</th>
              <th className="px-4 py-3 text-left">Enforcement</th>
              <th className="px-4 py-3 text-left">% of limit</th>
              <th className="px-4 py-3 text-right">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-black/50 dark:text-white/50">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-red-600">
                  Failed to load usage overview: {(error as Error)?.message ?? "Unknown error"}
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.map((r) => (
              <OverviewRow key={r.orgId} row={r} onOpen={() => navigate(`/platform-admin/organizations/${r.orgId}`)} />
            ))}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-black/50 dark:text-white/50">
                  No organizations to display.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModelPricingSection />
    </div>
  );
}

function OverviewRow({ row, onOpen }: { row: OrgUsageOverviewRow; onOpen: () => void }) {
  // Only treat a limit as "live" when its enable flag is true — mirrors the
  // server-authoritative checkAiAllowed/checkSendsevenAllowed semantics used
  // by the per-org usage tab, so a disabled limit never renders as over/warn.
  const tokenLimit      = row.aiLimitsEnabled ? row.monthlyAiTokenLimit : null;
  const sendsevenLimit  = row.sendsevenLimitsEnabled ? row.monthlySendsevenMsgLimit : null;
  const hasLiveLimit    = tokenLimit != null || sendsevenLimit != null;

  const tokenPct = usagePct(row.totalTokens, tokenLimit);
  const sentPct  = usagePct(row.sentCount, sendsevenLimit);
  const pct = Math.max(tokenPct, sentPct);
  const over = (tokenLimit != null && row.totalTokens > tokenLimit)
    || (sendsevenLimit != null && row.sentCount > sendsevenLimit);
  const warn = !over && pct >= (row.warnThresholdPct ?? 80);
  // In monitor mode nothing is actually blocked — an "over" reading here is
  // informational only, so it must not render as the same solid red pill
  // that would represent an enforced breach.
  const isMonitorMode = (row.enforcementMode ?? "monitor") !== "enforce";

  return (
    <tr
      className="cursor-pointer border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
      onClick={onOpen}
      data-testid={`row-usage-${row.orgId}`}
    >
      <td className="px-4 py-3 font-medium">{row.orgName}</td>
      <td className="px-4 py-3">{formatCount(row.totalTokens)}</td>
      <td className="px-4 py-3">{formatCount(row.aiMessageCount)}</td>
      <td className="px-4 py-3 font-medium" data-testid={`text-cost-${row.orgId}`}>{formatMicrosAsUsd(row.costMicros)}</td>
      <td className="px-4 py-3">
        {formatCount(row.sentCount)}
        <span className="ml-1 text-xs text-black/40 dark:text-white/40">({formatCount(row.aiSentCount)} AI)</span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium dark:bg-white/10">
          {row.enforcementMode ?? "monitor"}
        </span>
      </td>
      <td className="px-4 py-3">
        {!hasLiveLimit ? (
          <span className="text-xs text-black/40 dark:text-white/40">∞</span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              over && !isMonitorMode && "bg-red-500/10 text-red-700",
              over && isMonitorMode && "border border-amber-500/40 text-amber-700 dark:text-amber-400",
              !over && warn && "text-amber-600",
              !over && !warn && "text-emerald-700",
            )}
            data-testid={`text-pct-${row.orgId}`}
          >
            {pct}%
            {over && isMonitorMode && <span className="font-normal">(monitor)</span>}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="inline-flex items-center gap-1 text-xs font-medium text-black/70 hover:underline dark:text-white/80"
          data-testid={`button-open-usage-${row.orgId}`}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </button>
      </td>
    </tr>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5" data-testid={testId}>
      <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ModelPricingSection() {
  const { data: models = [], isLoading } = useAdminModelPricing();
  const [editTarget, setEditTarget] = useState<ModelPricingRow | "new" | null>(null);

  return (
    <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-black/5 p-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-black/60 dark:text-white/60" />
          <div className="font-medium">Model pricing</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditTarget("new")} data-testid="button-add-model-pricing">
          Add model
        </Button>
      </div>
      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>
      ) : models.length === 0 ? (
        <div className="p-6 text-center text-sm text-black/50 dark:text-white/50">No pricing configured yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-left">Input / MTok</th>
              <th className="px-4 py-3 text-left">Cached input / MTok</th>
              <th className="px-4 py-3 text-left">Output / MTok</th>
              <th className="px-4 py-3 text-left">Effective from</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-model-pricing-${m.model}`}>
                <td className="px-4 py-3 font-mono text-xs">{m.model}</td>
                <td className="px-4 py-3">{formatPricePerMtok(m.inputMicrosPerMtok)}</td>
                <td className="px-4 py-3">{formatPricePerMtok(m.cachedInputMicrosPerMtok)}</td>
                <td className="px-4 py-3">{formatPricePerMtok(m.outputMicrosPerMtok)}</td>
                <td className="px-4 py-3 text-xs text-black/50 dark:text-white/50">
                  {new Date(m.effectiveFrom).toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditTarget(m)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    data-testid={`button-edit-model-pricing-${m.model}`}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ModelPricingDialog
        target={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />
    </div>
  );
}

function ModelPricingDialog({
  target,
  open,
  onOpenChange,
}: {
  target: ModelPricingRow | "new" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isNew = target === "new";
  const existing = target && target !== "new" ? target : null;
  const upsert = useUpsertModelPricing();

  const [model, setModel]             = useState("");
  const [inputUsd, setInputUsd]       = useState("0");
  const [cachedUsd, setCachedUsd]     = useState("0");
  const [outputUsd, setOutputUsd]     = useState("0");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setModel(existing?.model ?? "");
    setInputUsd(existing ? String(existing.inputMicrosPerMtok / 1_000_000) : "0");
    setCachedUsd(existing ? String(existing.cachedInputMicrosPerMtok / 1_000_000) : "0");
    setOutputUsd(existing ? String(existing.outputMicrosPerMtok / 1_000_000) : "0");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  const toMicros = (usd: string): number | "invalid" => {
    const n = Number(usd);
    if (!Number.isFinite(n) || n < 0) return "invalid";
    return Math.round(n * 1_000_000);
  };

  const handleSave = async () => {
    if (!model.trim()) { setError("Model name is required."); return; }
    const inputMicros  = toMicros(inputUsd);
    const cachedMicros = toMicros(cachedUsd);
    const outputMicros = toMicros(outputUsd);
    if (inputMicros === "invalid" || cachedMicros === "invalid" || outputMicros === "invalid") {
      setError("Prices must be non-negative numbers (in $ per 1,000,000 tokens).");
      return;
    }
    setError(null);

    try {
      await upsert.mutateAsync({
        model: model.trim(),
        patch: {
          inputMicrosPerMtok: inputMicros,
          cachedInputMicrosPerMtok: cachedMicros,
          outputMicrosPerMtok: outputMicros,
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to save model pricing");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-model-pricing">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add model pricing" : `Edit pricing — ${existing?.model}`}</DialogTitle>
          <DialogDescription>
            Creates a new pricing version effective now. Existing usage keeps its original snapshotted cost.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Model</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} disabled={!isNew} placeholder="e.g. gpt-4.1" data-testid="input-model-name" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Input $/MTok</label>
              <Input type="number" min={0} step="0.01" value={inputUsd} onChange={(e) => setInputUsd(e.target.value)} data-testid="input-price-input" />
            </div>
            <div>
              <label className="text-sm font-medium">Cached $/MTok</label>
              <Input type="number" min={0} step="0.01" value={cachedUsd} onChange={(e) => setCachedUsd(e.target.value)} data-testid="input-price-cached" />
            </div>
            <div>
              <label className="text-sm font-medium">Output $/MTok</label>
              <Input type="number" min={0} step="0.01" value={outputUsd} onChange={(e) => setOutputUsd(e.target.value)} data-testid="input-price-output" />
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={upsert.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={upsert.isPending} data-testid="button-save-model-pricing">
            {upsert.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
