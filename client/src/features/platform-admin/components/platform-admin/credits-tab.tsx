import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Pencil, PlusCircle, XCircle, Receipt, History } from "lucide-react";
import {
  useAdminCreditSummary,
  useAdminCreditUsage,
  useAdminCreditCharges,
} from "@/hooks/queries";
import {
  useUpdateCreditLimit,
  useUpdateOveragePrice,
  useTopUpCredits,
  useWriteOffCharge,
} from "@/hooks/mutations";
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
import type { CreditChargeRow, CreditUsageRow, ChargeStatus } from "@/features/platform-admin/api/platform-admin.api";

const formatCents = (n: number) => `$${(n / 100).toFixed(2)}`;
const formatPeriod = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

const STATUS_OPTIONS: { value: ChargeStatus | "all"; label: string }[] = [
  { value: "all",         label: "All" },
  { value: "pending",     label: "Pending" },
  { value: "invoiced",    label: "Invoiced" },
  { value: "paid",        label: "Paid" },
  { value: "written_off", label: "Written off" },
];

export function CreditsTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { data: summary, isLoading } = useAdminCreditSummary(orgId);
  const [limitOpen, setLimitOpen]   = useState(false);
  const [priceOpen, setPriceOpen]   = useState(false);
  const [topUpOpen, setTopUpOpen]   = useState(false);

  if (isLoading || !summary) {
    return <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>;
  }

  const usagePct = summary.currentPeriod.allowance === 0
    ? 0
    : Math.min(100, Math.round((summary.currentPeriod.creditsUsed / summary.currentPeriod.allowance) * 100));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard label="This month" hint={formatPeriod(summary.currentPeriod.periodStart)} accent={summary.enabled ? undefined : "warn"}>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-semibold" data-testid="text-credits-used">{summary.currentPeriod.creditsUsed}</div>
            <div className="pb-1 text-sm text-black/50 dark:text-white/50">
              / {summary.currentPeriod.allowance}
              {summary.currentPeriod.creditsGranted > 0 && (
                <span className="text-xs text-black/40"> (+{summary.currentPeriod.creditsGranted} granted)</span>
              )}
            </div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                summary.currentPeriod.overageCredits > 0 ? "bg-red-500" : "bg-emerald-500",
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {summary.currentPeriod.overageCredits > 0 ? (
            <div className="mt-2 text-xs font-medium text-red-600">
              {summary.currentPeriod.overageCredits} over limit
            </div>
          ) : (
            <div className="mt-2 text-xs text-black/50 dark:text-white/50">
              {summary.currentPeriod.remaining} remaining
            </div>
          )}
          {!summary.enabled && (
            <div className="mt-2 text-xs font-medium text-amber-600">
              Credit enforcement disabled
            </div>
          )}
        </SummaryCard>

        <SummaryCard label="Monthly limit" hint="Free tier">
          <div className="text-3xl font-semibold" data-testid="text-monthly-limit">{summary.monthlyLimit}</div>
          <div className="text-xs text-black/50 dark:text-white/50">SMS / month</div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setLimitOpen(true)} data-testid="button-edit-limit">
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
        </SummaryCard>

        <SummaryCard label="Overage price" hint="per SMS">
          <div className="text-3xl font-semibold" data-testid="text-overage-price">{formatCents(summary.overagePriceCents)}</div>
          <div className="text-xs text-black/50 dark:text-white/50">
            Pending: <span className="font-medium" data-testid="text-pending-cents">{formatCents(summary.pendingChargesCents)}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPriceOpen(true)} data-testid="button-edit-price">
              <Pencil className="mr-1 h-3 w-3" /> Price
            </Button>
            <Button size="sm" onClick={() => setTopUpOpen(true)} data-testid="button-topup">
              <PlusCircle className="mr-1 h-3 w-3" /> Top up
            </Button>
          </div>
        </SummaryCard>
      </div>

      <ChargesPanel orgId={orgId} />
      <UsageHistoryPanel orgId={orgId} />

      <EditLimitDialog
        orgId={orgId}
        orgName={orgName}
        currentLimit={summary.monthlyLimit}
        currentEnabled={summary.enabled}
        open={limitOpen}
        onOpenChange={setLimitOpen}
      />
      <EditPriceDialog
        orgId={orgId}
        orgName={orgName}
        currentCents={summary.overagePriceCents}
        open={priceOpen}
        onOpenChange={setPriceOpen}
      />
      <TopUpDialog
        orgId={orgId}
        orgName={orgName}
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
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
  accent?: "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        accent === "warn"
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
          <MessageSquare className="h-3.5 w-3.5" />
          {label}
        </div>
        {hint && <div className="text-xs text-black/40 dark:text-white/40">{hint}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ChargesPanel({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<ChargeStatus | "all">("pending");
  const filter = status === "all" ? {} : { status };
  const { data: charges = [], isLoading } = useAdminCreditCharges(orgId, filter);
  const writeOff = useWriteOffCharge();
  const [writeOffTarget, setWriteOffTarget] = useState<CreditChargeRow | null>(null);
  const [reason, setReason] = useState("");

  const handleWriteOff = async () => {
    if (!writeOffTarget) return;
    try {
      await writeOff.mutateAsync({ orgId, chargeId: writeOffTarget.id, reason: reason.trim() || undefined });
      setWriteOffTarget(null);
      setReason("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-black/5 p-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-black/60 dark:text-white/60" />
          <div className="font-medium">Overage charges</div>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as ChargeStatus | "all")}>
          <SelectTrigger className="h-8 w-40" data-testid="select-charges-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>
      ) : charges.length === 0 ? (
        <div className="p-6 text-center text-sm text-black/50 dark:text-white/50">No charges in this category.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Credits</th>
              <th className="px-4 py-3 text-left">Unit</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-charge-${c.id}`}>
                <td className="px-4 py-3 text-xs">{formatPeriod(c.periodStart)}</td>
                <td className="px-4 py-3">{c.credits}</td>
                <td className="px-4 py-3">{formatCents(c.unitPriceCents)}</td>
                <td className="px-4 py-3 font-medium">{formatCents(c.amountCents)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-xs text-black/50 dark:text-white/50">
                  {new Date(c.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.status === "pending" && (
                    <button
                      onClick={() => setWriteOffTarget(c)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
                      data-testid={`button-write-off-${c.id}`}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Write off
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={!!writeOffTarget} onOpenChange={(o) => !o && setWriteOffTarget(null)}>
        <DialogContent data-testid="dialog-write-off">
          <DialogHeader>
            <DialogTitle>Write off charge</DialogTitle>
            <DialogDescription>
              Mark this charge as written off. The row is preserved for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (optional)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer dispute, refund processed elsewhere" data-testid="input-write-off-reason" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWriteOffTarget(null)} disabled={writeOff.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleWriteOff} disabled={writeOff.isPending} data-testid="button-confirm-write-off">
              {writeOff.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Write off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: ChargeStatus }) {
  const map: Record<ChargeStatus, string> = {
    pending:     "bg-amber-500/10 text-amber-700",
    invoiced:    "bg-blue-500/10 text-blue-700",
    paid:        "bg-emerald-500/10 text-emerald-700",
    written_off: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", map[status])}>
      {status.replace("_", " ")}
    </span>
  );
}

function UsageHistoryPanel({ orgId }: { orgId: string }) {
  const { data: usage = [], isLoading } = useAdminCreditUsage(orgId, 12);

  if (isLoading) {
    return <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>;
  }
  if (usage.length === 0) {
    return null;
  }

  const max = Math.max(1, ...usage.map((u) => u.creditsUsed));

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-2 border-b border-black/5 pb-3 dark:border-white/10">
        <History className="h-4 w-4 text-black/60 dark:text-white/60" />
        <div className="font-medium">Usage history</div>
      </div>
      <div className="mt-4 grid gap-3">
        {usage.map((u: CreditUsageRow) => (
          <div key={u.id} className="flex items-center gap-3 text-sm">
            <div className="w-20 text-xs text-black/60 dark:text-white/60">{formatPeriod(u.periodStart)}</div>
            <div className="flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (u.creditsUsed / max) * 100)}%` }} />
              </div>
            </div>
            <div className="w-16 text-right text-xs tabular-nums" data-testid={`usage-row-${u.id}`}>{u.creditsUsed}</div>
            {u.creditsGranted > 0 && (
              <div className="w-12 text-right text-xs text-emerald-600">+{u.creditsGranted}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditLimitDialog({
  orgId, orgName, currentLimit, currentEnabled, open, onOpenChange,
}: {
  orgId: string;
  orgName: string;
  currentLimit: number;
  currentEnabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [limit, setLimit] = useState(String(currentLimit));
  const [enabled, setEnabled] = useState(currentEnabled);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateCreditLimit();

  useEffect(() => {
    if (!open) return;
    setLimit(String(currentLimit));
    setEnabled(currentEnabled);
    setError(null);
  }, [open, currentLimit, currentEnabled]);

  const handleSave = async () => {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 0) { setError("Limit must be a non-negative whole number."); return; }
    setError(null);
    try {
      await update.mutateAsync({ orgId, limit: n, enabled });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to update limit");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-limit">
        <DialogHeader>
          <DialogTitle>Edit monthly credit limit — {orgName}</DialogTitle>
          <DialogDescription>Free SMS per UTC calendar month. Anything beyond this is billed at the overage rate.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Monthly limit</label>
            <Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} data-testid="input-monthly-limit" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded"
              data-testid="checkbox-credits-enabled"
            />
            Credit enforcement enabled
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending} data-testid="button-save-limit">
            {update.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPriceDialog({
  orgId, orgName, currentCents, open, onOpenChange,
}: {
  orgId: string;
  orgName: string;
  currentCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [cents, setCents] = useState(String(currentCents));
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateOveragePrice();

  useEffect(() => {
    if (!open) return;
    setCents(String(currentCents));
    setError(null);
  }, [open, currentCents]);

  const handleSave = async () => {
    const n = Number(cents);
    if (!Number.isInteger(n) || n < 0) { setError("Price must be a non-negative whole number of cents."); return; }
    setError(null);
    try {
      await update.mutateAsync({ orgId, priceCents: n });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to update price");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-price">
        <DialogHeader>
          <DialogTitle>Edit overage price — {orgName}</DialogTitle>
          <DialogDescription>
            Existing charges keep their snapshotted price. Only future overage messages use the new rate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="text-sm font-medium">Price per SMS (cents)</label>
          <Input type="number" min={0} value={cents} onChange={(e) => setCents(e.target.value)} data-testid="input-price-cents" />
          <div className="text-xs text-black/50 dark:text-white/50">
            {formatCents(Number(cents) || 0)} per SMS
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending} data-testid="button-save-price">
            {update.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopUpDialog({
  orgId, orgName, open, onOpenChange,
}: {
  orgId: string;
  orgName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [credits, setCredits] = useState("100");
  const [reason, setReason]   = useState("");
  const [error, setError]     = useState<string | null>(null);
  const topUp = useTopUpCredits();

  useEffect(() => {
    if (!open) return;
    setCredits("100");
    setReason("");
    setError(null);
  }, [open]);

  const handleSave = async () => {
    const n = Number(credits);
    if (!Number.isInteger(n) || n <= 0) { setError("Top-up must be a positive whole number."); return; }
    setError(null);
    try {
      await topUp.mutateAsync({ orgId, credits: n, reason: reason.trim() || undefined });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to top up");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-topup">
        <DialogHeader>
          <DialogTitle>Top up credits — {orgName}</DialogTitle>
          <DialogDescription>
            Grants extra credits for the current month. Does not refund existing overage charges.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Credits to grant</label>
            <Input type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} data-testid="input-topup-credits" />
          </div>
          <div>
            <label className="text-sm font-medium">Reason (optional)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. goodwill, onboarding gift" data-testid="input-topup-reason" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={topUp.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={topUp.isPending} data-testid="button-save-topup">
            {topUp.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
