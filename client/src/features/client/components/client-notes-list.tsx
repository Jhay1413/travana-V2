import { useMemo, useState } from "react";
import { Pencil, Reply, Trash2 } from "lucide-react";
import { RichTextDisplay } from "@/components/shared/rich-text-editor";
import { NoteEditor } from "@/components/shared/note-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClientNotes } from "@/hooks/queries";
import { useCreateClientNote, useUpdateClientNote, useDeleteClientNote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { formatNoteDate, parseTimestamp } from "@/lib/note-time";
import type { TransactionNote } from "@/features/quote/types";
import type { User as ApiUser } from "@/features/user/types";
import type { HolidaySelection } from "@/features/client/types";

/** Which kind of deal (transaction) a note belongs to. */
export type DealKind = "enquiry" | "quote" | "booking";

/** Everything a note row needs to render + open the deal it belongs to. */
export interface DealLabelInfo {
  kind: DealKind;
  /** The enquiry/quote/booking's own id — NOT the transaction id — passed to onOpenDeal as `{ type: kind, id }`. */
  id: string;
  title: string;
}

/** transaction_id → deal label info, built once by the page from its already-loaded enquiries/quotes/bookings. */
export type DealLabelLookup = Map<string, DealLabelInfo>;

const DEAL_KIND_LABEL: Record<DealKind, string> = {
  enquiry: "Enquiry",
  quote: "Quote",
  booking: "Booking",
};

/** Small pill naming the deal a note was written on — clickable when the deal is in the lookup. */
function DealPill({
  dealInfo,
  onOpenDeal,
  "data-testid": testId,
}: {
  dealInfo: DealLabelInfo | null;
  onOpenDeal?: (selection: HolidaySelection) => void;
  "data-testid"?: string;
}) {
  const text = dealInfo ? `${DEAL_KIND_LABEL[dealInfo.kind]}: ${dealInfo.title}` : "Deal";
  const wrapperClassName =
    "ml-2 inline-flex max-w-[160px] shrink-0 items-center align-middle rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-black/60 dark:bg-white/10 dark:text-white/60";
  // Truncation with an ellipsis needs to be on an inner block-level node with
  // `min-w-0` — a flex item's default `min-width: auto` otherwise keeps it
  // sized to its content, so `truncate` on the flex wrapper itself never
  // actually clips anything.
  const label = (
    <span className="min-w-0 truncate" title={text}>
      {text}
    </span>
  );
  if (dealInfo && onOpenDeal) {
    return (
      <button
        type="button"
        onClick={() => onOpenDeal({ type: dealInfo.kind, id: dealInfo.id })}
        title={text}
        className={`${wrapperClassName} transition hover:bg-black/10 dark:hover:bg-white/15`}
        data-testid={testId}
      >
        {label}
      </button>
    );
  }
  return (
    <span title={text} className={wrapperClassName} data-testid={testId}>
      {label}
    </span>
  );
}

/** A single note — general customer-level or written on one of the customer's deals — with inline edit + delete. */
function ClientNoteRow({
  clientId,
  note,
  authorName,
  dealInfo,
  onOpenDeal,
}: {
  clientId: string;
  note: TransactionNote;
  authorName: string;
  /** Resolved deal label when the note has a transaction_id; null falls back to a generic "Deal" pill. */
  dealInfo: DealLabelInfo | null;
  onOpenDeal?: (selection: HolidaySelection) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();
  const updateMutation = useUpdateClientNote(clientId);
  const deleteMutation = useDeleteClientNote(clientId);

  const handleEdit = async (html: string) => {
    try {
      await updateMutation.mutateAsync({ id: note.id, content: html, transactionId: note.transaction_id });
      setIsEditing(false);
      toast({ title: "Note updated" });
    } catch (err) {
      // Keep the user in edit mode with their text intact: NoteEditor only
      // clears the editor when the onSubmit promise RESOLVES, so re-throw
      // after the toast rather than swallowing the failure here.
      toast({ title: "Failed to update note", variant: "destructive" });
      throw err;
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: note.id, transactionId: note.transaction_id },
      {
        onSuccess: () => {
          setConfirmDelete(false);
          toast({ title: "Note deleted" });
        },
        onError: () => {
          setConfirmDelete(false);
          toast({ title: "Failed to delete note", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="group px-1 py-3" data-testid={`client-index-note-${note.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-xs">
          <span className="font-semibold text-[#3b82f6]">{authorName}</span>
          <span className="text-black/40 dark:text-white/40"> – {formatNoteDate(note.createdAt)}</span>
          {note.parent_id && (
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-[10px] font-medium text-black/35 dark:text-white/35">
              <Reply className="h-3 w-3" /> Reply
            </span>
          )}
          {note.transaction_id && (
            <DealPill dealInfo={dealInfo} onOpenDeal={onOpenDeal} data-testid={`client-index-note-deal-${note.id}`} />
          )}
        </div>
        {!isEditing && (
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={deleteMutation.isPending}
              className="grid h-6 w-6 place-items-center rounded-sm text-black/40 transition hover:bg-black/5 hover:text-black disabled:pointer-events-none disabled:opacity-40 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              title="Edit note"
              aria-label="Edit note"
              data-testid={`client-index-note-edit-${note.id}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteMutation.isPending}
              className="grid h-6 w-6 place-items-center rounded-sm text-black/40 transition hover:bg-rose-50 hover:text-rose-500 disabled:pointer-events-none disabled:opacity-40 dark:text-white/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              title="Delete note"
              aria-label="Delete note"
              data-testid={`client-index-note-delete-${note.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="mt-1.5">
          <NoteEditor
            initialContent={note.content ?? undefined}
            onSubmit={handleEdit}
            onCancel={() => setIsEditing(false)}
            submitLabel="Save"
            isLoading={updateMutation.isPending}
            compact
          />
        </div>
      ) : (
        <div className="prose prose-sm mt-1 max-w-none text-[13px] leading-relaxed text-black/75 dark:text-white/75">
          <RichTextDisplay content={note.content || ""} />
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !deleteMutation.isPending && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>This note will be permanently removed. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} data-testid={`client-index-note-delete-cancel-${note.id}`}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid={`client-index-note-delete-confirm-${note.id}`}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Notes tab: ONE flat list, newest first — general customer-level notes plus
 * notes written on any of the customer's deals (enquiries/quotes/bookings),
 * each deal note carrying a small pill naming which deal it belongs to. No
 * sub-tabs or grouping — just a label on each row. Composer at the bottom
 * still creates general client-level notes only.
 */
export function ClientNotesList({
  clientId,
  users,
  dealsByTransactionId,
  onOpenDeal,
}: {
  clientId: string;
  users: ApiUser[];
  /** transaction_id → deal label, built by the page from its already-loaded enquiries/quotes/bookings. */
  dealsByTransactionId?: DealLabelLookup;
  /** Opens a deal's pill in the detail layout — the same handler AllHolidaysPanel's onSelect uses (not a URL navigation: the page's `?holiday=` parsing is a separate code path and calling it directly here is simpler than round-tripping through a URL update). */
  onOpenDeal?: (selection: HolidaySelection) => void;
}) {
  const { data: notes, isLoading, isError, refetch } = useClientNotes(clientId, { includeDeals: true });
  const { toast } = useToast();
  const createMutation = useCreateClientNote(clientId);

  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email || ""])), [users]);

  const rows = useMemo(
    () =>
      [...(notes ?? [])]
        .filter((n) => n.description !== "system")
        .sort((a, b) => parseTimestamp(b.createdAt).getTime() - parseTimestamp(a.createdAt).getTime()),
    [notes],
  );

  const handleCreate = async (html: string) => {
    try {
      await createMutation.mutateAsync({ content: html });
      toast({ title: "Note added" });
    } catch (err) {
      // Re-throw so NoteEditor keeps the typed content instead of clearing it
      // (it only clears on a resolved promise) — the toast is the only thing
      // the user sees, the rejection itself is swallowed by NoteEditor.
      toast({ title: "Failed to add note", variant: "destructive" });
      throw err;
    }
  };

  return (
    <div data-testid="client-index-notes">
      {isError ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center" data-testid="client-index-notes-error">
          <p className="text-[13px] text-black/40 dark:text-white/40">Couldn't load notes.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-sm border border-black/10 px-2.5 py-1 text-[12px] font-semibold text-black/70 transition hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
            data-testid="client-index-notes-retry"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <p className="py-8 text-center text-[13px] text-black/40 dark:text-white/40">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-black/40 dark:text-white/40">
          No notes yet. Add a general note about this customer below, or write one from any of their deals.
        </p>
      ) : (
        <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
          {rows.map((note) => {
            const authorName =
              note.author_name ||
              (note.user_id && userNameById.get(note.user_id)) ||
              (note.agent_id && userNameById.get(note.agent_id)) ||
              "Unknown";
            const dealInfo = note.transaction_id ? dealsByTransactionId?.get(note.transaction_id) ?? null : null;
            return (
              <ClientNoteRow
                key={note.id}
                clientId={clientId}
                note={note}
                authorName={authorName}
                dealInfo={dealInfo}
                onOpenDeal={onOpenDeal}
              />
            );
          })}
        </div>
      )}

      <div className="mt-3" data-testid="client-index-note-composer">
        <NoteEditor
          placeholder="Add a note about this customer…"
          onSubmit={handleCreate}
          isLoading={createMutation.isPending}
        />
      </div>
    </div>
  );
}
