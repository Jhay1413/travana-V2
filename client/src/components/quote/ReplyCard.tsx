import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpdateNote, useDeleteNote } from "@/hooks/mutations";
import type { TransactionNote } from "@/types/quote";
import { formatRelativeTime } from "./quote-types";
import { NoteEditor } from "./NoteEditor";

export function ReplyCard({ reply, quoteId }: { reply: TransactionNote; quoteId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const updateMutation = useUpdateNote(quoteId);
  const deleteMutation = useDeleteNote(quoteId);

  const handleEdit = (html: string) => {
    updateMutation.mutate(
      { id: reply.id, content: html },
      {
        onSuccess: () => { setIsEditing(false); toast({ title: "Reply updated" }); },
        onError: () => toast({ title: "Failed to update reply", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="group/reply rounded-xl border border-black/5 bg-white/50 p-2" data-testid={`reply-card-${reply.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[8px] font-bold text-emerald-600">
            {(reply.author_name || "A").charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] font-semibold text-black/70">{reply.author_name || "Agent"}</span>
          <span className="text-[9px] text-black/35">
            {formatRelativeTime(reply.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover/reply:opacity-100">
          <button type="button" onClick={() => setIsEditing(!isEditing)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/35 hover:bg-black/5 hover:text-black/60" data-testid={`reply-btn-edit-${reply.id}`}>
            <Pencil className="h-2.5 w-2.5" />
          </button>
          <button type="button" onClick={() => deleteMutation.mutate(reply.id)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/35 hover:bg-rose-50 hover:text-rose-500" data-testid={`reply-btn-delete-${reply.id}`}>
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-1.5">
          <NoteEditor initialContent={reply.content ?? undefined} onSubmit={handleEdit} onCancel={() => setIsEditing(false)} submitLabel="Save" isLoading={updateMutation.isPending} compact />
        </div>
      ) : (
        <div className="mt-1 prose prose-sm max-w-none text-[11px] text-black/60 [&_a]:text-[#3b82f6] [&_ul]:pl-3 [&_ol]:pl-3" dangerouslySetInnerHTML={{ __html: reply.content || "" }} data-testid={`reply-content-${reply.id}`} />
      )}
    </div>
  );
}
