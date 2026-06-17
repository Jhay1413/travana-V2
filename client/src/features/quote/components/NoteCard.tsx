import { useMemo, useState } from "react";
import { Pencil, Trash2, Pin, Reply, MessageSquare, Eye } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useUpdateNote, useDeleteNote, useCreateNote } from "@/hooks/mutations";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import type { TransactionNote } from "@/types/quote";
import { formatRelativeTime } from "./quote-types";
import { formatFullDateTime } from "@/lib/note-time";
import { NoteEditor } from "./NoteEditor";
import { ReplyCard } from "./ReplyCard";

export function NoteCard({
  note,
  replies,
  quoteId,
}: {
  note: TransactionNote;
  replies: TransactionNote[];
  quoteId: string;
  currentUserName?: string;
}) {
  const isSystem = note.description === "system";
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const { toast } = useToast();
  const updateMutation = useUpdateNote(quoteId);
  const deleteMutation = useDeleteNote(quoteId);
  const createMutation = useCreateNote(quoteId);
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const isNotePinned = useMemo(() => {
    if (!userFavorites) return false;
    return userFavorites.some((f: Favorite) => f.itemType === "note" && f.itemId === note.id);
  }, [userFavorites, note.id]);

  const handleEdit = (html: string) => {
    updateMutation.mutate(
      { id: note.id, content: html },
      {
        onSuccess: () => { setIsEditing(false); toast({ title: "Note updated" }); },
        onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(note.id, {
      onSuccess: () => toast({ title: "Note deleted" }),
      onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
    });
  };

  const handleReply = (html: string) => {
    createMutation.mutate(
      { transaction_id: quoteId, content: html },
      {
        onSuccess: () => { setIsReplying(false); toast({ title: "Reply added" }); },
        onError: () => toast({ title: "Failed to add reply", variant: "destructive" }),
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="group"
      data-testid={`note-card-${note.id}`}
    >
      <div className={`rounded-xl border p-2 text-[20px] ${isSystem ? "border-sky-200/60 bg-sky-50/50" : "border-black/10 bg-white/60"}`}>
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            {isSystem ? (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-500" data-testid={`note-avatar-${note.id}`}>
                <Eye className="h-2.5 w-2.5" />
              </div>
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[8px] font-bold text-[#3b82f6]" data-testid={`note-avatar-${note.id}`}>
                {(note.author_name || "A").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              {isSystem ? (
                <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-600" data-testid={`note-author-${note.id}`}>
                  System
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-black/80" data-testid={`note-author-${note.id}`}>{note.author_name || "Agent"}</span>
              )}
              <span className="ml-1.5 text-[9px] text-black/40" data-testid={`note-time-${note.id}`} title={formatFullDateTime(note.createdAt)}>
                {formatRelativeTime(note.createdAt)} · {formatFullDateTime(note.createdAt)}
              </span>
            </div>
          </div>
          {!isSystem && (
            <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => toggleFavoriteMutation.mutate(
                  { itemType: "note", itemId: note.id, label: `Note by ${note.author_name || "Agent"}`, subtitle: `quoteId:${quoteId}|${(note.content || "").replace(/<[^>]*>/g, "").slice(0, 40)}` },
                  { onSuccess: (data: { favorited?: boolean }) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
                )}
                className={`inline-flex h-5 w-5 items-center justify-center rounded transition ${isNotePinned ? "text-amber-600 hover:bg-amber-50" : "text-black/40 hover:bg-black/5 hover:text-black/70"}`}
                title={isNotePinned ? "Unpin" : "Pin to dashboard"}
                data-testid={`note-btn-pin-${note.id}`}
              >
                <Pin className="h-2.5 w-2.5" />
              </button>
              <button type="button" onClick={() => setIsReplying(!isReplying)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-black/5 hover:text-black/70" title="Reply" data-testid={`note-btn-reply-${note.id}`}>
                <Reply className="h-2.5 w-2.5" />
              </button>
              <button type="button" onClick={() => setIsEditing(!isEditing)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-black/5 hover:text-black/70" title="Edit" data-testid={`note-btn-edit-${note.id}`}>
                <Pencil className="h-2.5 w-2.5" />
              </button>
              <button type="button" onClick={handleDelete} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-rose-50 hover:text-rose-500" title="Delete" data-testid={`note-btn-delete-${note.id}`}>
                <Trash2 className="h-2.5 w-2.5" />
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
          <div
            className="mt-1 prose prose-sm max-w-none text-[11px] leading-relaxed text-black/70 [&_a]:text-[#3b82f6] [&_ul]:pl-3 [&_ol]:pl-3"
            dangerouslySetInnerHTML={{ __html: note.content || "" }}
            data-testid={`note-content-${note.id}`}
          />
        )}

        {replies.length > 0 && (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setShowReplies(!showReplies)}
              className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#3b82f6] transition hover:text-[#3b82f6]/80"
              data-testid={`note-toggle-replies-${note.id}`}
            >
              <MessageSquare className="h-2.5 w-2.5" />
              {showReplies ? "Hide" : "Show"} {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>

            <AnimatePresence>
              {showReplies && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1.5 space-y-1 overflow-hidden border-l-2 border-[#3b82f6]/20 pl-2"
                >
                  {replies.map((reply) => (
                    <ReplyCard key={reply.id} reply={reply} quoteId={quoteId} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {isReplying && (
          <div className="mt-1.5">
            <NoteEditor
              placeholder="Write a reply..."
              onSubmit={handleReply}
              onCancel={() => setIsReplying(false)}
              submitLabel="Reply"
              isLoading={createMutation.isPending}
              compact
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
