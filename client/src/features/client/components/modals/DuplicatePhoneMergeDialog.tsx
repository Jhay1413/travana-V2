import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Mail, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDuplicatePhoneGroup } from "@/hooks/queries";
import { useMergeDuplicateClients } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import type { DuplicateGroupClient } from "@/features/client/types/neon-client";

function clientName(client: DuplicateGroupClient) {
  return [client.firstName, client.surename].filter(Boolean).join(" ").trim() || "Unknown client";
}

// Above this many clients on one number, it's far more likely a shop/office or
// placeholder number than one person entered twice — live data has 56 unrelated
// clients on a single landline. Merging those together would be destructive, so
// the dialog warns instead of quietly presenting them as duplicates.
const SHARED_NUMBER_THRESHOLD = 5;

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-GB");
}

/**
 * One count in a client's activity summary. Zero is greyed rather than hidden —
 * "0 bookings" is exactly the signal that marks the empty shell record, so it
 * has to be visible for the comparison to be readable at a glance.
 */
function DealStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const emphasised = highlight && value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] ${
        emphasised
          ? "bg-emerald-500/10 font-semibold text-emerald-700"
          : value > 0
            ? "bg-black/[0.04] text-black/60"
            : "bg-black/[0.02] text-black/25"
      }`}
    >
      <span className="font-semibold">{value}</span>
      {label}
    </span>
  );
}

/**
 * Resolve one duplicate phone number: show every client holding it, let the
 * user nominate the main record, and fold the rest into it in a single request.
 *
 * The default nomination is the client with the most deals (ties broken by the
 * oldest record) — that's almost always the real account, and it minimises how
 * much history has to move.
 */
export function DuplicatePhoneMergeDialog({
  phoneKey,
  displayPhone,
  onOpenChange,
}: {
  phoneKey: string | null;
  displayPhone?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { data, isLoading } = useDuplicatePhoneGroup(phoneKey);
  const mergeMutation = useMergeDuplicateClients();

  const [mainClientId, setMainClientId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const clients = useMemo(() => data?.clients ?? [], [data]);
  const looksShared = clients.length >= SHARED_NUMBER_THRESHOLD;

  // The server sorts the group most-bookings-first, so the head of the list is
  // already the likeliest real record.
  const suggestedMainId = clients[0]?.id ?? null;

  // Seed the defaults ONCE per opened group, tracked by ref: a background
  // refetch hands back a new `clients` array, and re-seeding on that would wipe
  // the user's ticks mid-decision. Closing clears everything so a stale id can
  // never be submitted against the next group.
  //
  // A small group is almost certainly one person duplicated, so everything is
  // pre-ticked; a large one looks like a shared number, so nothing is and the
  // user opts in per record.
  const seededKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!phoneKey) {
      seededKeyRef.current = null;
      setMainClientId(null);
      setSelectedIds(new Set());
      return;
    }
    if (clients.length === 0 || seededKeyRef.current === phoneKey) return;
    seededKeyRef.current = phoneKey;
    setMainClientId(suggestedMainId);
    setSelectedIds(
      looksShared ? new Set() : new Set(clients.filter((c) => c.id !== suggestedMainId).map((c) => c.id)),
    );
  }, [phoneKey, suggestedMainId, looksShared, clients]);

  const mainClient = clients.find((c) => c.id === mainClientId) ?? null;
  // The main client can never be a source, whatever the checkbox state says.
  const sourceIds = clients.filter((c) => c.id !== mainClientId && selectedIds.has(c.id)).map((c) => c.id);

  function chooseMain(id: string) {
    setMainClientId(id);
    // Promoting a record to main removes it from the merge selection, so the
    // two roles can never overlap.
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleSource(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleMerge() {
    if (!mainClientId || sourceIds.length === 0) return;
    mergeMutation.mutate(
      { targetId: mainClientId, sourceIds },
      {
        onSuccess: (result) => {
          if (result.failed.length > 0) {
            toast({
              title: `Merged ${result.mergedIds.length} of ${result.mergedIds.length + result.failed.length} duplicates`,
              description: result.failed[0]?.error,
              variant: "destructive",
            });
          } else {
            toast({ title: `${result.mergedIds.length} duplicate client(s) merged` });
          }
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          toast({
            title: "Failed to merge duplicates",
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <Dialog open={!!phoneKey} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl" data-testid="dialog-duplicate-phone-merge">
        <DialogHeader>
          <DialogTitle>Duplicate clients on {displayPhone ?? phoneKey}</DialogTitle>
          <DialogDescription>
            Pick the main client to keep (blue), then tick the records that are the same person (red). Their
            deals, files, notes, tickets and messages move onto the main client and the ticked records are
            archived.
          </DialogDescription>
        </DialogHeader>

        {looksShared && (
          <div
            className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-3 py-2.5 text-red-700"
            data-testid="warning-shared-number"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs">
              {clients.length} different clients share this number. That usually means a shop, office or
              placeholder number rather than one person entered twice — check the names below carefully before
              merging anything.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-black/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading duplicates...
          </div>
        ) : clients.length === 0 ? (
          <p className="py-10 text-center text-sm text-black/40" data-testid="empty-duplicate-group">
            These duplicates have already been resolved.
          </p>
        ) : (
          <ul className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
            {clients.map((client) => {
              const isMain = client.id === mainClientId;
              const isSource = !isMain && selectedIds.has(client.id);
              const created = formatDate(client.createdAt);
              const lastActivity = formatDate(client.lastActivityAt);
              return (
                <li key={client.id}>
                  <div
                    className={`flex items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                      isMain
                        ? "border-blue-500/40 bg-blue-500/5"
                        : isSource
                          ? "border-red-500/30 bg-red-500/[0.04]"
                          : "border-black/10"
                    }`}
                    data-testid={`duplicate-client-option-${client.id}`}
                  >
                    <div className="mt-0.5 flex shrink-0 flex-col items-center gap-2">
                      <input
                        type="radio"
                        name="duplicate-main-client"
                        title="Keep as the main client"
                        className="h-4 w-4 cursor-pointer accent-blue-600"
                        checked={isMain}
                        onChange={() => chooseMain(client.id)}
                        data-testid={`radio-duplicate-main-${client.id}`}
                      />
                      <input
                        type="checkbox"
                        title="Merge this client into the main client"
                        className="h-4 w-4 cursor-pointer accent-red-600 disabled:opacity-20"
                        checked={isSource}
                        disabled={isMain}
                        onChange={() => toggleSource(client.id)}
                        data-testid={`checkbox-duplicate-source-${client.id}`}
                      />
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                      <UserRound className="h-4 w-4 text-black/40" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-black/80">{clientName(client)}</span>
                        {isMain ? (
                          <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            Main client
                          </span>
                        ) : isSource ? (
                          <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            Will be merged &amp; archived
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold text-black/40">
                            Left alone
                          </span>
                        )}
                        {client.badge && (
                          <span className="shrink-0 rounded-full border border-black/10 px-2 py-0.5 text-[10px] font-semibold text-black/50">
                            {client.badge}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-black/40">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {client.phoneNumber}
                        </span>
                        {client.email && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-1.5 flex flex-wrap items-center gap-1.5"
                        data-testid={`text-duplicate-deals-${client.id}`}
                      >
                        <DealStat label="enquiries" value={client.enquiryCount} />
                        <DealStat label="quotes" value={client.quoteCount} />
                        <DealStat label="bookings" value={client.bookingCount} highlight />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-black/40">
                        {lastActivity && <span>Last activity {lastActivity}</span>}
                        {created && <span>Added {created}</span>}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {clients.length > 0 && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs" data-testid="text-duplicate-merge-summary">
              {sourceIds.length === 0 ? (
                <>Tick the records that are the same person as{" "}
                <span className="font-semibold">{mainClient ? clientName(mainClient) : "the main client"}</span>.
                Anything left unticked is untouched.</>
              ) : (
                <>
                  {sourceIds.length} client{sourceIds.length === 1 ? "" : "s"} will be merged into{" "}
                  <span className="font-semibold">{mainClient ? clientName(mainClient) : "the main client"}</span>.
                  This cannot be undone from the app — the duplicates are archived (not deleted) for audit.
                </>
              )}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => onOpenChange(false)}
            data-testid="button-duplicate-merge-cancel"
          >
            Cancel
          </Button>
          <Button
            className="rounded-2xl bg-red-600 text-white hover:bg-red-700"
            onClick={handleMerge}
            disabled={!mainClientId || sourceIds.length === 0 || mergeMutation.isPending}
            data-testid="button-duplicate-merge-confirm"
          >
            {mergeMutation.isPending
              ? "Merging..."
              : `Merge ${sourceIds.length} duplicate${sourceIds.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
