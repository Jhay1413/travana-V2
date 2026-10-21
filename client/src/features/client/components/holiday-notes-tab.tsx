import { useMemo, useState } from "react";
import { Pencil, Reply, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { groupNotesByParent } from "@/features/note/lib/group-notes";
import { useNotes, useUsers } from "@/hooks/queries";
import { useUpdateNote, useDeleteNote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { NoteEditor } from "@/components/shared/note-editor";
import { useCreateNoteWithAttachments, NoteAttachments } from "@/features/note";
import type { TransactionNote } from "@/features/quote/types";

// ─── Notes tab ──────────────────────────────────────────────────────────────
// Mock-styled note cards: light grey card, round avatar, blue author name with
// "– 25 Aug 2026, 12:52", always-visible reply / edit / delete actions at the
// right. Same notes hooks as QuoteNotesSection; only the presentation differs.
// New notes are added via the bottom composer, so the tab has no editor.

export function formatNoteDateTime(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

// The author's uploaded profile photo (user.image) when they have one,
// otherwise their initial in a blue circle.
export function NoteAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-avatar-blue-bg text-sm font-bold text-avatar-blue-fg">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function HolidayNoteCard({
  note,
  replies,
  transactionId,
  avatarByUserId,
  readOnly = false,
}: {
  note: TransactionNote;
  replies: TransactionNote[];
  transactionId: string;
  avatarByUserId: Map<string, string | null>;
  readOnly?: boolean;
}) {
  const isSystem = note.description === "system";
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();
  const updateMutation = useUpdateNote(transactionId);
  const deleteMutation = useDeleteNote(transactionId);
  const createMutation = useCreateNoteWithAttachments(transactionId);

  const authorName = isSystem ? "System" : note.author_name || "Agent";
  const authorId = note.user_id || note.agent_id;
  const avatarUrl = !isSystem && authorId ? avatarByUserId.get(authorId) : null;

  const handleEdit = (html: string) => {
    updateMutation.mutate(
      { id: note.id, content: html },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast({ title: "Note updated" });
        },
        onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
      },
    );
  };

  const handleReply = async (html: string, files?: File[]) => {
    try {
      const { uploadFailed } = await createMutation.mutateAsync({ data: { transaction_id: transactionId, content: html, parent_id: note.id }, files });
      setIsReplying(false);
      toast(uploadFailed
        ? { title: "Reply added, but its attachments failed to upload", variant: "destructive" }
        : { title: "Reply added" });
    } catch (err) {
      toast({ title: "Failed to add reply", variant: "destructive" });
      // Re-throw so NoteEditor keeps the typed content and files.
      throw err;
    }
  };

  return (
    <div className="relative mt-5" data-testid={`holiday-note-${note.id}`}>
      {/* Avatar sits at the card's top-left, straddling the TOP edge — half
          above it, half inside, per the design. The wrapper's mt-5 reserves
          room for the protruding half. */}
      <div className="absolute -top-5 left-0">
        <NoteAvatar name={authorName} imageUrl={avatarUrl} />
      </div>
      <div className="min-w-0 rounded-[10px] bg-black/[0.03] py-3 pl-12 pr-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-[13px] 3xl:text-[15px]">
            <span className="font-semibold text-avatar-blue-fg">{authorName}</span>
            <span className="text-black/45"> – {formatNoteDateTime(note.createdAt)}</span>
          </div>
          {!isSystem && !readOnly && (
            <div className="flex shrink-0 items-center gap-1.5 text-qp-muted">
              <button
                type="button"
                onClick={() => setIsReplying((v) => !v)}
                className="grid h-6 w-6 place-items-center rounded-[10px] transition hover:bg-black/5 hover:text-avatar-blue-fg"
                title="Reply"
                data-testid={`holiday-note-reply-${note.id}`}
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="grid h-6 w-6 place-items-center rounded-[10px] transition hover:bg-black/5 hover:text-avatar-blue-fg"
                title="Edit"
                data-testid={`holiday-note-edit-${note.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  deleteMutation.mutate(note.id, {
                    onSuccess: () => toast({ title: "Note deleted" }),
                    onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
                  })
                }
                className="grid h-6 w-6 place-items-center rounded-[10px] transition hover:bg-rose-50 hover:text-rose-500"
                title="Delete"
                data-testid={`holiday-note-delete-${note.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="mt-2">
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
          <div
            className="prose prose-sm mt-1 max-w-none text-[13px] leading-relaxed text-black/70 3xl:text-[15px] [&_a]:text-avatar-blue-fg [&_ol]:pl-4 [&_ul]:pl-4"
            dangerouslySetInnerHTML={{ __html: note.content || "" }}
            data-testid={`holiday-note-content-${note.id}`}
          />
        )}
        <NoteAttachments transactionId={transactionId} noteId={note.id} />
        {replies.length > 0 && (
          <div className="mt-3 space-y-2 border-l-2 border-avatar-blue-fg/20 pl-3">
            {replies.map((reply) => (
              <div key={reply.id} className="text-[13px]" data-testid={`holiday-note-reply-row-${reply.id}`}>
                <span className="font-semibold text-avatar-blue-fg">{reply.author_name || "Agent"}</span>
                <span className="text-black/45"> – {formatNoteDateTime(reply.createdAt)}</span>
                <div
                  className="prose prose-sm mt-0.5 max-w-none leading-relaxed text-black/70"
                  dangerouslySetInnerHTML={{ __html: reply.content || "" }}
                />
                <NoteAttachments transactionId={transactionId} noteId={reply.id} />
              </div>
            ))}
          </div>
        )}
        {isReplying && (
          <div className="mt-2">
            <NoteEditor
              placeholder="Write a reply…"
              allowAttachments
              onSubmit={handleReply}
              onCancel={() => setIsReplying(false)}
              submitLabel="Reply"
              isLoading={createMutation.isPending}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function HolidayNotesTab({ transactionId, readOnly = false }: { transactionId: string; readOnly?: boolean }) {
  const { data: notesData, isLoading } = useNotes(transactionId);
  const { data: users = [] } = useUsers();
  const avatarByUserId = useMemo(
    () => new Map(users.map((u) => [u.id, (u as { image?: string | null }).image ?? null])),
    [users],
  );

  const { topLevelNotes, repliesByParent } = useMemo(() => {
    const grouped = groupNotesByParent(notesData || []);
    return {
      topLevelNotes: [...grouped.topLevel].sort(
        (x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime(),
      ),
      repliesByParent: grouped.repliesByParent,
    };
  }, [notesData]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (topLevelNotes.length === 0) {
    return <p className="py-8 text-center text-[13px] text-black/40">{readOnly ? "No notes yet." : "No notes yet. Add one below."}</p>;
  }
  return (
    <div className="space-y-3" data-testid="holiday-detail-notes">
      {topLevelNotes.map((note) => (
        <HolidayNoteCard
          key={note.id}
          note={note}
          replies={repliesByParent.get(note.id) || []}
          transactionId={transactionId}
          avatarByUserId={avatarByUserId}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
