import { useState } from "react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useReferrals } from "@/hooks/queries/use-referral-queries";
import { useVipPayouts } from "@/hooks/queries/use-vip-payout-queries";
import {
  useUpdateReferralStatus,
  useUpdateReferralPayoutType,
  useDeleteReferral,
} from "@/hooks/mutations/use-referral-mutations";
import { useCreateVipPayout, useProcessVipPayout } from "@/hooks/mutations/use-vip-payout-mutations";
import { useToast } from "@/hooks/use-toast";
import type { AdminReferral } from "@/api/endpoints/referral.api";
import type { AdminVipPayout } from "@/api/endpoints/vip-payout.api";
import {
  Gift,
  Wallet,
  CheckCircle2,
  Clock,
  Ban,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Banknote,
  CreditCard,
  Trash2,
  ArrowRight,
  Users,
  TrendingUp,
  CircleDollarSign,
  Filter,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Status configs ────────────────────────────────────────────────────────────

const REFERRAL_STATUS_CONFIG: Record<
  AdminReferral["referralStatus"],
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING: { label: "Pending", color: "bg-amber-500/10 text-amber-700 border-amber-500/25", icon: Clock },
  IN_WALLET: { label: "In Wallet", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25", icon: Wallet },
  PAID: { label: "Paid", color: "bg-blue-500/10 text-blue-700 border-blue-500/25", icon: CheckCircle2 },
  VOIDED: { label: "Voided", color: "bg-black/5 text-black/40 border-black/10", icon: Ban },
};

const PAYOUT_STATUS_CONFIG: Record<
  AdminVipPayout["status"],
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Pending", color: "bg-amber-500/10 text-amber-700 border-amber-500/25", icon: Clock },
  processed: { label: "Processed", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25", icon: CheckCircle2 },
};

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  bank_transfer: { label: "Bank Transfer", icon: Banknote },
  booking_credit: { label: "Booking Credit", icon: CreditCard },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(str: string | null) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(str: string | null | undefined) {
  if (!str) return "£0.00";
  return `£${parseFloat(str).toFixed(2)}`;
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white p-4 flex items-center gap-4">
      <div className={cn("p-3 rounded-lg", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-black/40 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-black/80 leading-tight">{value}</p>
        {sub && <p className="text-xs text-black/40 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Create Payout Dialog ──────────────────────────────────────────────────────

function CreatePayoutDialog({
  referral,
  open,
  onClose,
}: {
  referral: AdminReferral | null;
  open: boolean;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<"bank_transfer" | "booking_credit">("bank_transfer");
  const [notes, setNotes] = useState("");
  const createPayout = useCreateVipPayout();
  const { toast } = useToast();

  function handleSubmit() {
    if (!referral) return;
    createPayout.mutate(
      { referralId: referral.id, method, notes: notes || undefined },
      {
        onSuccess: () => {
          toast({ title: "Payout created", description: `${formatAmount(referral.payoutAmount)} moved to wallet` });
          setNotes("");
          onClose();
        },
        onError: (err: any) =>
          toast({ title: "Failed to create payout", description: err?.response?.data?.message ?? err?.message, variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Payout</DialogTitle>
        </DialogHeader>
        {referral && (
          <div className="space-y-4">
            <div className="rounded-lg bg-black/[0.04] p-3 text-sm space-y-1">
              <p className="font-medium text-black/70">Referrer: {referral.referrerName ?? "—"}</p>
              <p className="text-black/50">Referred: {referral.referredName}</p>
              <p className="font-semibold text-emerald-700 text-base">{formatAmount(referral.payoutAmount)}</p>
            </div>

            <div className="space-y-2">
              <Label>Payout Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["bank_transfer", "booking_credit"] as const).map((m) => {
                  const { label, icon: Icon } = METHOD_CONFIG[m];
                  return (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all",
                        method === m
                          ? "border-black/30 bg-black/5 text-black"
                          : "border-black/10 text-black/50 hover:border-black/20"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Bank details confirmed, processed via BACS..."
                rows={3}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createPayout.isPending}>
            {createPayout.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Payout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Process Payout Dialog ─────────────────────────────────────────────────────

function ProcessPayoutDialog({
  payout,
  open,
  onClose,
}: {
  payout: AdminVipPayout | null;
  open: boolean;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const processPayout = useProcessVipPayout();
  const { toast } = useToast();

  function handleSubmit() {
    if (!payout) return;
    processPayout.mutate(
      { id: payout.id, notes: notes || undefined },
      {
        onSuccess: () => {
          toast({ title: "Payout processed", description: `${formatAmount(payout.amount)} marked as paid` });
          setNotes("");
          onClose();
        },
        onError: (err: any) =>
          toast({ title: "Failed to process payout", description: err?.response?.data?.message ?? err?.message, variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Payout as Processed</DialogTitle>
        </DialogHeader>
        {payout && (
          <div className="space-y-4">
            <div className="rounded-lg bg-black/[0.04] p-3 text-sm space-y-1">
              <p className="font-medium text-black/70">{payout.clientName ?? "Unknown client"}</p>
              <p className="text-black/50">{METHOD_CONFIG[payout.method]?.label ?? payout.method}</p>
              <p className="font-semibold text-blue-700 text-base">{formatAmount(payout.amount)}</p>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Sent via BACS on 11 Apr 2026..."
                rows={3}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={processPayout.isPending}>
            {processPayout.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm Processed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Referral row ──────────────────────────────────────────────────────────────

function ReferralRow({
  referral,
  onCreatePayout,
  onVoid,
  onDelete,
}: {
  referral: AdminReferral;
  onCreatePayout: (r: AdminReferral) => void;
  onVoid: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = REFERRAL_STATUS_CONFIG[referral.referralStatus];
  const StatusIcon = status.icon;

  const canPayout = referral.referralStatus === "PENDING" && !!referral.payoutAmount;
  const canVoid = referral.referralStatus === "PENDING" || referral.referralStatus === "IN_WALLET";
  const canDelete = referral.referralStatus !== "PAID";

  return (
    <div className={cn(
      "border border-black/[0.08] rounded-xl bg-white overflow-hidden",
      referral.isDue && referral.referralStatus === "PENDING" && "border-amber-400/50 ring-1 ring-amber-400/20"
    )}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-black/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-black/80 truncate">{referral.referredName}</span>
            {referral.isDue && referral.referralStatus === "PENDING" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-500/15 text-amber-700 border border-amber-400/30 rounded-full px-2 py-0.5">
                <AlertCircle className="h-3 w-3" />
                Due for payout
              </span>
            )}
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            Referrer: <span className="text-black/60">{referral.referrerName ?? "—"}</span>
            {referral.referrerPhone && <span className="ml-1 text-black/40">· {referral.referrerPhone}</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-black/70">{formatAmount(referral.payoutAmount)}</span>

          <span className={cn("inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5", status.color)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>

          {expanded ? <ChevronUp className="h-4 w-4 text-black/30" /> : <ChevronDown className="h-4 w-4 text-black/30" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-black/[0.06] px-4 py-4 bg-black/[0.01]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm mb-4">
            <div>
              <p className="text-xs text-black/40 mb-0.5">Travel Date</p>
              <p className="font-medium text-black/70">{formatDate(referral.travelDate)}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Payout Due</p>
              <p className="font-medium text-black/70">{formatDate(referral.payoutTriggerDate)}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Gross Commission</p>
              <p className="font-medium text-black/70">{formatAmount(referral.commission)}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Payout Amount</p>
              <p className="font-semibold text-emerald-700">{formatAmount(referral.payoutAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Payout Type</p>
              <p className="font-medium text-black/70">
                {referral.payoutType ? METHOD_CONFIG[referral.payoutType]?.label : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Created</p>
              <p className="font-medium text-black/70">{formatDate(referral.createdAt)}</p>
            </div>
            {referral.referredEmail && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Email</p>
                <p className="font-medium text-black/70">{referral.referredEmail}</p>
              </div>
            )}
            {referral.referredPhone && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Phone</p>
                <p className="font-medium text-black/70">{referral.referredPhone}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canPayout && (
              <Button size="sm" onClick={() => onCreatePayout(referral)} className="gap-1.5">
                <ArrowRight className="h-3.5 w-3.5" />
                Create Payout
              </Button>
            )}
            {canVoid && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-amber-700 border-amber-400/40 hover:bg-amber-50"
                onClick={() => onVoid(referral.id)}
              >
                <Ban className="h-3.5 w-3.5" />
                Void
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-600 border-red-400/40 hover:bg-red-50"
                onClick={() => onDelete(referral.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payout row ────────────────────────────────────────────────────────────────

function PayoutRow({
  payout,
  onProcess,
}: {
  payout: AdminVipPayout;
  onProcess: (p: AdminVipPayout) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = PAYOUT_STATUS_CONFIG[payout.status];
  const StatusIcon = status.icon;
  const { icon: MethodIcon, label: methodLabel } = METHOD_CONFIG[payout.method] ?? { icon: Banknote, label: payout.method };

  return (
    <div className="border border-black/[0.08] rounded-xl bg-white overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-black/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-black/80">{payout.clientName ?? "Unknown client"}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <MethodIcon className="h-3 w-3 text-black/40" />
            <span className="text-xs text-black/40">{methodLabel}</span>
            {payout.referredName && (
              <>
                <span className="text-black/20">·</span>
                <span className="text-xs text-black/40">Referred: <span className="text-black/60 font-medium">{payout.referredName}</span></span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-black/70">{formatAmount(payout.amount)}</span>
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5", status.color)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-black/30" /> : <ChevronDown className="h-4 w-4 text-black/30" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-black/[0.06] px-4 py-4 bg-black/[0.01]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm mb-4">
            <div>
              <p className="text-xs text-black/40 mb-0.5">Referrer Phone</p>
              <p className="font-medium text-black/70">{payout.clientPhone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Referrer Email</p>
              <p className="font-medium text-black/70">{payout.clientEmail ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-black/40 mb-0.5">Referred Client</p>
              <p className="font-medium text-black/70">{payout.referredName ?? "—"}</p>
            </div>
            {payout.referredEmail && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Referred Email</p>
                <p className="font-medium text-black/70">{payout.referredEmail}</p>
              </div>
            )}
            {payout.travelDate && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Travel Date</p>
                <p className="font-medium text-black/70">{formatDate(payout.travelDate)}</p>
              </div>
            )}
            {payout.referralStatus && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Referral Status</p>
                <p className="font-medium text-black/70">{payout.referralStatus}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-black/40 mb-0.5">Created</p>
              <p className="font-medium text-black/70">{formatDate(payout.createdAt)}</p>
            </div>
            {payout.processedAt && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Processed At</p>
                <p className="font-medium text-black/70">{formatDate(payout.processedAt)}</p>
              </div>
            )}
            {payout.notes && (
              <div className="col-span-full">
                <p className="text-xs text-black/40 mb-0.5">Notes</p>
                <p className="text-black/60">{payout.notes}</p>
              </div>
            )}
          </div>

          {payout.status === "pending" && (
            <Button size="sm" onClick={() => onProcess(payout)} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark as Processed
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "referrals" | "payouts";

export function AdminReferrals() {
  const [tab, setTab] = useState<Tab>("referrals");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("all");

  const { data: referrals = [], isLoading: loadingReferrals } = useReferrals();
  const { data: payouts = [], isLoading: loadingPayouts } = useVipPayouts();

  const updateStatus = useUpdateReferralStatus();
  const deleteReferral = useDeleteReferral();
  const { toast } = useToast();

  const [createPayoutFor, setCreatePayoutFor] = useState<AdminReferral | null>(null);
  const [processPayoutFor, setProcessPayoutFor] = useState<AdminVipPayout | null>(null);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const dueCount = referrals.filter((r) => r.isDue && r.referralStatus === "PENDING").length;
  const totalPending = referrals
    .filter((r) => r.referralStatus === "PENDING")
    .reduce((s, r) => s + parseFloat(r.payoutAmount ?? "0"), 0);
  const totalPaid = payouts
    .filter((p) => p.status === "processed")
    .reduce((s, p) => s + parseFloat(p.amount), 0);

  // ── Filtered lists ──────────────────────────────────────────────────────────
  const filteredReferrals = referrals.filter((r) => {
    if (statusFilter !== "all" && r.referralStatus !== statusFilter) return false;
    if (dueFilter === "due" && !(r.isDue && r.referralStatus === "PENDING")) return false;
    return true;
  });

  const filteredPayouts = payouts.filter((p) => {
    if (payoutStatusFilter !== "all" && p.status !== payoutStatusFilter) return false;
    return true;
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleVoid(id: string) {
    updateStatus.mutate(
      { id, status: "VOIDED" },
      {
        onSuccess: () => toast({ title: "Referral voided" }),
        onError: (err: any) =>
          toast({ title: "Failed to void", description: err?.response?.data?.message ?? err?.message, variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: string) {
    deleteReferral.mutate(id, {
      onSuccess: () => toast({ title: "Referral deleted" }),
      onError: (err: any) =>
        toast({ title: "Failed to delete", description: err?.response?.data?.message ?? err?.message, variant: "destructive" }),
    });
  }

  return (
    <>
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">

        {/* Page heading */}
        <div>
          <h1 className="text-2xl font-bold text-black/80 flex items-center gap-2">
            <Gift className="h-6 w-6 text-violet-600" />
            VIP Referral Scheme
          </h1>
          <p className="text-sm text-black/40 mt-1">Manage referrals, payout approvals, and client rewards</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Referrals"
            value={referrals.length}
            icon={Users}
            color="bg-violet-500/10 text-violet-600"
          />
          <StatCard
            label="Due for Payout"
            value={dueCount}
            sub="8 weeks before travel"
            icon={AlertCircle}
            color={dueCount > 0 ? "bg-amber-500/10 text-amber-600" : "bg-black/5 text-black/40"}
          />
          <StatCard
            label="Pending Value"
            value={`£${totalPending.toFixed(2)}`}
            icon={TrendingUp}
            color="bg-emerald-500/10 text-emerald-600"
          />
          <StatCard
            label="Total Paid Out"
            value={`£${totalPaid.toFixed(2)}`}
            icon={CircleDollarSign}
            color="bg-blue-500/10 text-blue-600"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-black/[0.08]">
          {(["referrals", "payouts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px",
                tab === t
                  ? "border-black text-black"
                  : "border-transparent text-black/40 hover:text-black/60"
              )}
            >
              {t === "referrals" ? `Referrals (${referrals.length})` : `Payouts (${payouts.length})`}
            </button>
          ))}
        </div>

        {/* ── REFERRALS TAB ── */}
        {tab === "referrals" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-black/30" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_WALLET">In Wallet</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="VOIDED">Voided</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dueFilter} onValueChange={setDueFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All referrals</SelectItem>
                  <SelectItem value="due">Due for payout</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-black/40 ml-auto">{filteredReferrals.length} result{filteredReferrals.length !== 1 ? "s" : ""}</span>
            </div>

            {/* List */}
            {loadingReferrals ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-black/30" />
              </div>
            ) : filteredReferrals.length === 0 ? (
              <div className="text-center py-16">
                <Gift className="h-10 w-10 text-black/20 mx-auto mb-3" />
                <p className="text-black/40 text-sm">No referrals found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredReferrals.map((r) => (
                  <ReferralRow
                    key={r.id}
                    referral={r}
                    onCreatePayout={setCreatePayoutFor}
                    onVoid={handleVoid}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PAYOUTS TAB ── */}
        {tab === "payouts" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-black/30" />
              <Select value={payoutStatusFilter} onValueChange={setPayoutStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-black/40 ml-auto">{filteredPayouts.length} result{filteredPayouts.length !== 1 ? "s" : ""}</span>
            </div>

            {/* List */}
            {loadingPayouts ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-black/30" />
              </div>
            ) : filteredPayouts.length === 0 ? (
              <div className="text-center py-16">
                <Wallet className="h-10 w-10 text-black/20 mx-auto mb-3" />
                <p className="text-black/40 text-sm">No payouts found</p>
                <p className="text-xs text-black/30 mt-1">Create payouts from the Referrals tab</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPayouts.map((p) => (
                  <PayoutRow key={p.id} payout={p} onProcess={setProcessPayoutFor} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreatePayoutDialog
        referral={createPayoutFor}
        open={!!createPayoutFor}
        onClose={() => setCreatePayoutFor(null)}
      />
      <ProcessPayoutDialog
        payout={processPayoutFor}
        open={!!processPayoutFor}
        onClose={() => setProcessPayoutFor(null)}
      />
    </>
  );
}

export default function AdminReferralsPage() {
  return (
    <CommandCenterShell title="VIP Referrals" theme="light" filterSlot={<></>} onRoleChange={() => {}}>
      <AdminReferrals />
    </CommandCenterShell>
  );
}
