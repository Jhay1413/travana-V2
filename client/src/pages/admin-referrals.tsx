import { useState } from "react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useReferrals } from "@/hooks/queries/use-referral-queries";
import { useReferralPayouts } from "@/hooks/queries/use-referral-payout-queries";
import { useReferralWithdrawals } from "@/hooks/queries/use-referral-withdrawal-queries";
import {
  useUpdateReferralStatus,
  useDeleteReferral,
} from "@/hooks/mutations/use-referral-mutations";
import {
  useApproveReferralPayout,
  useRejectReferralPayout,
} from "@/hooks/mutations/use-referral-payout-mutations";
import {
  useProcessReferralWithdrawal,
  useRejectReferralWithdrawal,
} from "@/hooks/mutations/use-referral-withdrawal-mutations";
import { useToast } from "@/hooks/use-toast";
import type { AdminReferral } from "@/api/endpoints/referral.api";
import type { AdminReferralPayout } from "@/api/endpoints/referral-payout.api";
import type { AdminReferralWithdrawal } from "@/api/endpoints/referral-withdrawal.api";
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
  Users,
  TrendingUp,
  CircleDollarSign,
  Filter,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Status configs ────────────────────────────────────────────────────────────

const REFERRAL_STATUS_CONFIG: Record<
  AdminReferral["referralStatus"],
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING: { label: "Pending", color: "bg-amber-500/10 text-amber-700 border-amber-500/25", icon: Clock },
  IN_WALLET: { label: "In Wallet", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25", icon: Wallet },
  PAID: { label: "Paid Out", color: "bg-blue-500/10 text-blue-700 border-blue-500/25", icon: CheckCircle2 },
  VOIDED: { label: "Voided", color: "bg-black/5 text-black/40 border-black/10", icon: Ban },
};

const PAYOUT_STATUS_CONFIG: Record<
  AdminReferralPayout["status"],
  { label: string; color: string; icon: React.ElementType }
> = {
  requested: { label: "Pending Approval", color: "bg-violet-500/10 text-violet-700 border-violet-500/25", icon: AlertCircle },
  approved: { label: "Approved", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-700 border-red-500/25", icon: XCircle },
};

const WITHDRAWAL_STATUS_CONFIG: Record<
  AdminReferralWithdrawal["status"],
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Action Required", color: "bg-amber-500/10 text-amber-700 border-amber-500/25", icon: AlertCircle },
  processed: { label: "Paid", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-700 border-red-500/25", icon: XCircle },
};

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  bank_transfer: { label: "Bank Transfer", icon: Banknote },
  booking_credit: { label: "Booking Credit", icon: CreditCard },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(str: string | null | undefined) {
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

// ── Approve Payout Dialog ─────────────────────────────────────────────────────

function ApprovePayoutDialog({
  payout,
  open,
  onClose,
}: {
  payout: AdminReferralPayout | null;
  open: boolean;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const approve = useApproveReferralPayout();
  const { toast } = useToast();

  function handleSubmit() {
    if (!payout) return;
    approve.mutate(
      { id: payout.id, notes: notes || undefined },
      {
        onSuccess: () => {
          toast({ title: "Payout approved", description: `${formatAmount(payout.amount)} credited to client wallet` });
          setNotes("");
          onClose();
        },
        onError: (err: any) =>
          toast({ title: "Failed to approve", description: err?.response?.data?.message ?? err?.message, variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-emerald-600" />
            Approve Payout Request
          </DialogTitle>
        </DialogHeader>
        {payout && (
          <div className="space-y-4">
            <div className="rounded-lg bg-black/[0.04] p-3 text-sm space-y-1">
              <p className="font-medium text-black/70">{payout.clientName ?? "Unknown client"}</p>
              <p className="text-black/50">Referred: {payout.referredName ?? "—"}</p>
              <p className="font-semibold text-emerald-700 text-base">{formatAmount(payout.amount)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
              Approving will credit this amount to the client's wallet (referral moves to <strong>In Wallet</strong>).
            </div>
            <div className="space-y-2">
              <Label>Notes <span className="text-black/30 font-normal">(optional)</span></Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes for this approval..."
                rows={2}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={approve.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            {approve.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Approve & Credit Wallet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Process Withdrawal Dialog ─────────────────────────────────────────────────

function ProcessWithdrawalDialog({
  withdrawal,
  open,
  onClose,
}: {
  withdrawal: AdminReferralWithdrawal | null;
  open: boolean;
  onClose: () => void;
}) {
  const [transferReference, setTransferReference] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [notes, setNotes] = useState("");
  const processWithdrawal = useProcessReferralWithdrawal();
  const { toast } = useToast();

  const isBankTransfer = withdrawal?.method === "bank_transfer";

  function handleSubmit() {
    if (!withdrawal) return;
    processWithdrawal.mutate(
      {
        id: withdrawal.id,
        data: {
          transfer_reference: transferReference || undefined,
          credit_note: creditNote || undefined,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: isBankTransfer ? "Bank transfer confirmed" : "Booking credit applied",
            description: `${formatAmount(withdrawal.amount)} marked as paid`,
          });
          setTransferReference("");
          setCreditNote("");
          setNotes("");
          onClose();
        },
        onError: (err: any) =>
          toast({ title: "Failed to process", description: err?.response?.data?.message ?? err?.message, variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBankTransfer
              ? <><Banknote className="h-5 w-5 text-emerald-600" /> Confirm Bank Transfer</>
              : <><CreditCard className="h-5 w-5 text-blue-600" /> Confirm Booking Credit Applied</>
            }
          </DialogTitle>
        </DialogHeader>
        {withdrawal && (
          <div className="space-y-4">
            <div className="rounded-lg bg-black/[0.04] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-black/80 text-sm">{withdrawal.clientName ?? "Unknown client"}</p>
                  {withdrawal.clientPhone && <p className="text-xs text-black/40">{withdrawal.clientPhone}</p>}
                  {withdrawal.clientEmail && <p className="text-xs text-black/40">{withdrawal.clientEmail}</p>}
                </div>
                <p className="font-bold text-lg text-emerald-700">{formatAmount(withdrawal.amount)}</p>
              </div>
              {withdrawal.referredName && (
                <p className="text-xs text-black/40 border-t border-black/[0.06] pt-2">
                  Referral: <span className="text-black/60 font-medium">{withdrawal.referredName}</span>
                </p>
              )}
            </div>

            {/* Bank details (for bank transfer) */}
            {isBankTransfer && (withdrawal.account_name || withdrawal.account_number || withdrawal.sort_code) && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-1">
                <p className="font-semibold text-emerald-800 mb-1">Client's bank details</p>
                {withdrawal.account_name && <p className="text-emerald-700">Name: <span className="font-medium">{withdrawal.account_name}</span></p>}
                {withdrawal.account_number && <p className="text-emerald-700">Account: <span className="font-medium">{withdrawal.account_number}</span></p>}
                {withdrawal.sort_code && <p className="text-emerald-700">Sort code: <span className="font-medium">{withdrawal.sort_code}</span></p>}
              </div>
            )}

            <div className={cn(
              "rounded-lg border p-3 text-sm",
              isBankTransfer
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            )}>
              {isBankTransfer ? (
                <>
                  <p className="font-semibold mb-1">Action required: Send bank transfer</p>
                  <p className="text-emerald-700 text-xs">Transfer {formatAmount(withdrawal.amount)} to the client's account above, then confirm below.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold mb-1">Action required: Apply booking credit</p>
                  <p className="text-blue-700 text-xs">Apply {formatAmount(withdrawal.amount)} as credit toward the client's booking, then confirm below.</p>
                </>
              )}
            </div>

            {isBankTransfer ? (
              <div className="space-y-2">
                <Label>Transfer Reference <span className="text-black/30 font-normal">(optional)</span></Label>
                <Input
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  placeholder="e.g. TXN-2026-0411"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Credit Note / Booking Reference <span className="text-black/30 font-normal">(optional)</span></Label>
                <Input
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="e.g. Applied to booking REF-12345"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes <span className="text-black/30 font-normal">(optional)</span></Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={processWithdrawal.isPending}
            className={isBankTransfer ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}
          >
            {processWithdrawal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isBankTransfer ? "Confirm Transfer Sent" : "Confirm Credit Applied"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Referral row ──────────────────────────────────────────────────────────────

function ReferralRow({
  referral,
  onVoid,
  onDelete,
}: {
  referral: AdminReferral;
  onVoid: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = REFERRAL_STATUS_CONFIG[referral.referralStatus] ?? REFERRAL_STATUS_CONFIG["PENDING"];
  const StatusIcon = status.icon;

  const canVoid = referral.referralStatus === "PENDING" || referral.referralStatus === "IN_WALLET";
  const canDelete = referral.referralStatus !== "PAID";

  return (
    <div className={cn(
      "border border-black/[0.08] rounded-xl bg-white overflow-hidden",
      referral.isDue && referral.referralStatus === "PENDING" && "border-amber-400/50 ring-1 ring-amber-400/20"
    )}>
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

// ── Payout Request row ────────────────────────────────────────────────────────

function PayoutRequestRow({
  payout,
  onApprove,
  onReject,
}: {
  payout: AdminReferralPayout;
  onApprove: (p: AdminReferralPayout) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = PAYOUT_STATUS_CONFIG[payout.status];
  const StatusIcon = statusCfg.icon;
  const isRequested = payout.status === "requested";

  return (
    <div className={cn(
      "border rounded-xl bg-white overflow-hidden",
      isRequested ? "border-violet-400/50 ring-1 ring-violet-400/15" : "border-black/[0.08]"
    )}>
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-black/80">{payout.clientName ?? "Unknown client"}</span>
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5", statusCfg.color)}>
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            Referred: <span className="text-black/60">{payout.referredName ?? "—"}</span>
            {payout.travelDate && <span className="ml-1">· Travel: {formatDate(payout.travelDate)}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-black/80">{formatAmount(payout.amount)}</span>
          {isRequested && (
            <>
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onApprove(payout); }}
                className="h-7 text-xs gap-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <ThumbsUp className="h-3 w-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onReject(payout.id); }}
                className="h-7 text-xs gap-1 px-3 text-red-600 border-red-400/40 hover:bg-red-50"
              >
                <ThumbsDown className="h-3 w-3" />
                Reject
              </Button>
            </>
          )}
          <button onClick={() => setExpanded((v) => !v)} className="text-black/30 hover:text-black/50">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-black/[0.06] px-4 py-4 bg-black/[0.01]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {payout.clientPhone && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Phone</p>
                <p className="font-medium text-black/70">{payout.clientPhone}</p>
              </div>
            )}
            {payout.clientEmail && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Email</p>
                <p className="font-medium text-black/70">{payout.clientEmail}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-black/40 mb-0.5">Requested</p>
              <p className="font-medium text-black/70">{formatDate(payout.requested_at)}</p>
            </div>
            {payout.approved_at && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Approved</p>
                <p className="font-medium text-black/70">{formatDate(payout.approved_at)}</p>
              </div>
            )}
            {payout.rejected_at && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Rejected</p>
                <p className="font-medium text-black/70">{formatDate(payout.rejected_at)}</p>
              </div>
            )}
            {payout.notes && (
              <div className="col-span-full">
                <p className="text-xs text-black/40 mb-0.5">Notes</p>
                <p className="text-black/60">{payout.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Withdrawal row ────────────────────────────────────────────────────────────

function WithdrawalRow({
  withdrawal,
  onProcess,
  onReject,
}: {
  withdrawal: AdminReferralWithdrawal;
  onProcess: (w: AdminReferralWithdrawal) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = withdrawal.status === "pending";
  const isBankTransfer = withdrawal.method === "bank_transfer";
  const { icon: MethodIcon, label: methodLabel } = METHOD_CONFIG[withdrawal.method] ?? { icon: Banknote, label: withdrawal.method };
  const statusCfg = WITHDRAWAL_STATUS_CONFIG[withdrawal.status];

  return (
    <div className={cn(
      "border rounded-xl bg-white overflow-hidden",
      isPending
        ? isBankTransfer
          ? "border-emerald-400/50 ring-1 ring-emerald-400/15"
          : "border-blue-400/50 ring-1 ring-blue-400/15"
        : "border-black/[0.08]"
    )}>
      <div className="flex items-center gap-3 p-4">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
          isPending
            ? isBankTransfer ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
            : "bg-black/[0.04] text-black/40"
        )}>
          <MethodIcon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-black/80">{withdrawal.clientName ?? "Unknown client"}</span>
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5", statusCfg.color)}>
              <statusCfg.icon className="h-3 w-3" />
              {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-black/40">{methodLabel}</span>
            {withdrawal.referredName && (
              <>
                <span className="text-black/20">·</span>
                <span className="text-xs text-black/40">ref: <span className="text-black/60 font-medium">{withdrawal.referredName}</span></span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-black/80">{formatAmount(withdrawal.amount)}</span>
          {isPending && (
            <>
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onProcess(withdrawal); }}
                className={cn(
                  "h-7 text-xs gap-1 px-3",
                  isBankTransfer ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
                )}
              >
                <CheckCircle2 className="h-3 w-3" />
                {isBankTransfer ? "Confirm transfer" : "Confirm credit"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onReject(withdrawal.id); }}
                className="h-7 text-xs gap-1 px-3 text-red-600 border-red-400/40 hover:bg-red-50"
              >
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            </>
          )}
          <button onClick={() => setExpanded((v) => !v)} className="text-black/30 hover:text-black/50">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-black/[0.06] px-4 py-4 bg-black/[0.01]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {withdrawal.clientPhone && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Phone</p>
                <p className="font-medium text-black/70">{withdrawal.clientPhone}</p>
              </div>
            )}
            {withdrawal.clientEmail && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Email</p>
                <p className="font-medium text-black/70">{withdrawal.clientEmail}</p>
              </div>
            )}
            {isBankTransfer && (
              <>
                {withdrawal.account_name && (
                  <div>
                    <p className="text-xs text-black/40 mb-0.5">Account Name</p>
                    <p className="font-medium text-black/70">{withdrawal.account_name}</p>
                  </div>
                )}
                {withdrawal.account_number && (
                  <div>
                    <p className="text-xs text-black/40 mb-0.5">Account Number</p>
                    <p className="font-medium text-black/70">{withdrawal.account_number}</p>
                  </div>
                )}
                {withdrawal.sort_code && (
                  <div>
                    <p className="text-xs text-black/40 mb-0.5">Sort Code</p>
                    <p className="font-medium text-black/70">{withdrawal.sort_code}</p>
                  </div>
                )}
                {withdrawal.transfer_reference && (
                  <div>
                    <p className="text-xs text-black/40 mb-0.5">Transfer Reference</p>
                    <p className="font-medium text-black/70">{withdrawal.transfer_reference}</p>
                  </div>
                )}
              </>
            )}
            {!isBankTransfer && withdrawal.credit_note && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Credit Note</p>
                <p className="font-medium text-black/70">{withdrawal.credit_note}</p>
              </div>
            )}
            {withdrawal.travelDate && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Travel Date</p>
                <p className="font-medium text-black/70">{formatDate(withdrawal.travelDate)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-black/40 mb-0.5">Requested</p>
              <p className="font-medium text-black/70">{formatDate(withdrawal.requested_at)}</p>
            </div>
            {withdrawal.processed_at && (
              <div>
                <p className="text-xs text-black/40 mb-0.5">Processed</p>
                <p className="font-medium text-black/70">{formatDate(withdrawal.processed_at)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "referrals" | "payouts" | "withdrawals";

export function AdminReferrals() {
  const [tab, setTab] = useState<Tab>("referrals");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");

  const { data: referrals = [], isLoading: loadingReferrals } = useReferrals();
  const { data: payouts = [], isLoading: loadingPayouts } = useReferralPayouts();
  const { data: withdrawals = [], isLoading: loadingWithdrawals } = useReferralWithdrawals();

  const updateStatus = useUpdateReferralStatus();
  const deleteReferral = useDeleteReferral();
  const rejectPayout = useRejectReferralPayout();
  const rejectWithdrawal = useRejectReferralWithdrawal();
  const { toast } = useToast();

  const [approvePayoutFor, setApprovePayoutFor] = useState<AdminReferralPayout | null>(null);
  const [processWithdrawalFor, setProcessWithdrawalFor] = useState<AdminReferralWithdrawal | null>(null);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const pendingPayoutCount = payouts.filter((p) => p.status === "requested").length;
  const pendingWithdrawalCount = withdrawals.filter((w) => w.status === "pending").length;
  const walletBalance = referrals
    .filter((r) => r.referralStatus === "IN_WALLET")
    .reduce((s, r) => s + parseFloat(r.payoutAmount ?? "0"), 0);
  const totalPaid = withdrawals
    .filter((w) => w.status === "processed")
    .reduce((s, w) => s + parseFloat(w.amount), 0);

  // ── Filtered lists ──────────────────────────────────────────────────────────
  const filteredReferrals = referrals.filter((r) => {
    if (statusFilter !== "all" && r.referralStatus !== statusFilter) return false;
    if (dueFilter === "due" && !(r.isDue && r.referralStatus === "PENDING")) return false;
    return true;
  });

  const sortedWithdrawals = [...withdrawals].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime();
  });

  const sortedPayouts = [...payouts].sort((a, b) => {
    if (a.status === "requested" && b.status !== "requested") return -1;
    if (a.status !== "requested" && b.status === "requested") return 1;
    return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime();
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

  function handleRejectPayout(id: string) {
    rejectPayout.mutate(
      { id },
      {
        onSuccess: () => toast({ title: "Payout request rejected" }),
        onError: (err: any) =>
          toast({ title: "Failed to reject", description: err?.response?.data?.message ?? err?.message, variant: "destructive" }),
      }
    );
  }

  function handleRejectWithdrawal(id: string) {
    rejectWithdrawal.mutate(
      { id },
      {
        onSuccess: () => toast({ title: "Withdrawal rejected", description: "Referral returned to wallet" }),
        onError: (err: any) =>
          toast({ title: "Failed to reject", description: err?.response?.data?.message ?? err?.message, variant: "destructive" }),
      }
    );
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
            label="Payout Requests"
            value={pendingPayoutCount}
            sub="Awaiting approval"
            icon={AlertCircle}
            color={pendingPayoutCount > 0 ? "bg-violet-500/10 text-violet-600" : "bg-black/5 text-black/40"}
          />
          <StatCard
            label="Wallet Balance"
            value={`£${walletBalance.toFixed(2)}`}
            sub="Across all clients"
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
          {(["referrals", "payouts", "withdrawals"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t
                  ? "border-black text-black"
                  : "border-transparent text-black/40 hover:text-black/60"
              )}
            >
              {t === "referrals" && "Referrals"}
              {t === "payouts" && (
                <span className="flex items-center gap-1.5">
                  Payout Requests
                  {pendingPayoutCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-500 text-white text-[10px] font-bold">
                      {pendingPayoutCount}
                    </span>
                  )}
                </span>
              )}
              {t === "withdrawals" && (
                <span className="flex items-center gap-1.5">
                  Withdrawals
                  {pendingWithdrawalCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {pendingWithdrawalCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── REFERRALS TAB ── */}
        {tab === "referrals" && (
          <div className="space-y-4">
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
                    onVoid={handleVoid}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PAYOUT REQUESTS TAB ── */}
        {tab === "payouts" && (
          <div className="space-y-4">
            {pendingPayoutCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span><span className="font-semibold">{pendingPayoutCount} payout request{pendingPayoutCount !== 1 ? "s" : ""}</span> awaiting approval — approve to credit the client's wallet.</span>
              </div>
            )}

            {loadingPayouts ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-black/30" />
              </div>
            ) : sortedPayouts.length === 0 ? (
              <div className="text-center py-16">
                <Wallet className="h-10 w-10 text-black/20 mx-auto mb-3" />
                <p className="text-black/40 text-sm">No payout requests yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedPayouts.map((p) => (
                  <PayoutRequestRow
                    key={p.id}
                    payout={p}
                    onApprove={setApprovePayoutFor}
                    onReject={handleRejectPayout}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── WITHDRAWALS TAB ── */}
        {tab === "withdrawals" && (
          <div className="space-y-4">
            {pendingWithdrawalCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span><span className="font-semibold">{pendingWithdrawalCount} withdrawal{pendingWithdrawalCount !== 1 ? "s" : ""}</span> waiting for action — confirm the transfer or credit has been done.</span>
              </div>
            )}

            {loadingWithdrawals ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-black/30" />
              </div>
            ) : sortedWithdrawals.length === 0 ? (
              <div className="text-center py-16">
                <Wallet className="h-10 w-10 text-black/20 mx-auto mb-3" />
                <p className="text-black/40 text-sm">No withdrawal requests yet</p>
                <p className="text-xs text-black/30 mt-1">Requests appear here once a client withdraws from their wallet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedWithdrawals.map((w) => (
                  <WithdrawalRow
                    key={w.id}
                    withdrawal={w}
                    onProcess={setProcessWithdrawalFor}
                    onReject={handleRejectWithdrawal}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ApprovePayoutDialog
        payout={approvePayoutFor}
        open={!!approvePayoutFor}
        onClose={() => setApprovePayoutFor(null)}
      />
      <ProcessWithdrawalDialog
        withdrawal={processWithdrawalFor}
        open={!!processWithdrawalFor}
        onClose={() => setProcessWithdrawalFor(null)}
      />
    </>
  );
}

export default function AdminReferralsPage() {
  return (
    <CommandCenterShell title="VIP Referrals" theme="light" filterSlot={<></>} role="admin" onRoleChange={() => {}}>
      <AdminReferrals />
    </CommandCenterShell>
  );
}

