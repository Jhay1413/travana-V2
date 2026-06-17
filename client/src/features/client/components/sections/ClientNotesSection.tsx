import { useState } from "react";
import { StickyNote, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useClientNotes } from "@/hooks/queries/use-note-queries";
import {
  useCreateClientNote,
  useUpdateClientNote,
  useDeleteClientNote,
} from "@/hooks/mutations/use-note-mutations";
import { useToast } from "@/hooks/use-toast";
import { formatUKDate } from "../client-types";
import type { TransactionNote } from "@/types/quote";

interface ClientNotesSectionProps {
  clientId: string;
}

export function ClientNotesSection({ clientId }: ClientNotesSectionProps) {
  const { toast } = useToast();
  const { data: notes = [], isLoading } = useClientNotes(clientId);
  const createNote = useCreateClientNote(clientId);
  const updateNote = useUpdateClientNote(clientId);
  const deleteNote = useDeleteClientNote(clientId);

  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const handleCreate = () => {
    const content = draft.trim();
    if (!content || createNote.isPending) return;
    createNote.mutate(
      { content },
      {
        onSuccess: () => {
          setDraft("");
          setIsAdding(false);
        },
        onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
      },
    );
  };

  const handleUpdate = (id: string) => {
    const content = editDraft.trim();
    if (!content || updateNote.isPending) return;
    updateNote.mutate(
      { id, content },
      {
        onSuccess: () => setEditingId(null),
        onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: string) => {
    if (deleteNote.isPending) return;
    deleteNote.mutate(id, {
      onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
    });
  };

  const startEdit = (note: TransactionNote) => {
    setEditingId(note.id);
    setEditDraft(note.content || "");
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-client-notes">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-black/60" />
          <div className="text-sm font-semibold text-black">Client Notes</div>
          <span className="text-[11px] font-medium text-black/40">({notes.length})</span>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-black/70 transition hover:bg-black/[0.04]"
            data-testid="button-add-client-note"
          >
            <Plus className="h-3.5 w-3.5" />
            Add note
          </button>
        )}
      </div>

      {isAdding && (
        <div className="mb-3 rounded-xl border border-black/10 bg-white/65 p-2.5" data-testid="client-note-composer">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note about this client..."
            rows={3}
            className="w-full resize-y rounded-lg border border-black/10 bg-white/80 px-2.5 py-2 text-xs text-black/80 outline-none focus:border-[#3b82f6]/40"
            data-testid="input-client-note"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setDraft("");
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-black/55 transition hover:bg-black/[0.04]"
              data-testid="button-cancel-client-note"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!draft.trim() || createNote.isPending}
              className="inline-flex items-center gap-1 rounded-full bg-[#3b82f6] px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-[#3b82f6]/90 disabled:opacity-60"
              data-testid="button-save-client-note"
            >
              {createNote.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Save note"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : notes.length === 0 && !isAdding ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-4 text-center text-xs text-black/45" data-testid="empty-client-notes">
          No notes for this client yet
        </div>
      ) : (
        <div className="grid gap-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-black/10 bg-white/65 p-2.5"
              data-testid={`client-note-${note.id}`}
            >
              {editingId === note.id ? (
                <>
                  <textarea
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-black/10 bg-white/80 px-2.5 py-2 text-xs text-black/80 outline-none focus:border-[#3b82f6]/40"
                    data-testid={`input-edit-client-note-${note.id}`}
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-black/55 transition hover:bg-black/[0.04]"
                      data-testid={`button-cancel-edit-client-note-${note.id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate(note.id)}
                      disabled={!editDraft.trim() || updateNote.isPending}
                      className="inline-flex items-center gap-1 rounded-full bg-[#3b82f6] px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-[#3b82f6]/90 disabled:opacity-60"
                      data-testid={`button-save-edit-client-note-${note.id}`}
                    >
                      {updateNote.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {note.description && (
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-black/40">
                      {note.description}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-xs text-black/80">{note.content}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-black/45">
                      {note.author_name ? `${note.author_name} · ` : ""}
                      {note.createdAt ? formatUKDate(note.createdAt) : ""}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(note)}
                        className="grid h-7 w-7 place-items-center rounded-full text-black/45 transition hover:bg-black/[0.05] hover:text-black/70"
                        title="Edit note"
                        data-testid={`button-edit-client-note-${note.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="grid h-7 w-7 place-items-center rounded-full text-black/45 transition hover:bg-rose-50 hover:text-rose-500"
                        title="Delete note"
                        data-testid={`button-delete-client-note-${note.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
