import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";
import { useNotes } from "@/hooks/queries";
import { useCreateNote } from "@/hooks/mutations";
import { useCurrentUser } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import type { TransactionNote } from "@/types/quote";
import { NoteCard } from "./NoteCard";
import { NoteEditor } from "./NoteEditor";

export function QuoteNotesSection({ transactionId }: { transactionId: string }) {
  const { data: notesData, isLoading } = useNotes(transactionId);
  const { data: currentUser } = useCurrentUser();
  const createMutation = useCreateNote(transactionId);
  const { toast } = useToast();

  const authorName = currentUser?.name || "Agent";

  const topLevelNotes = useMemo(() => {
    if (!notesData) return [];
    return notesData.filter((n) => !n.parent_id);
  }, [notesData]);

  const repliesByParent = useMemo(() => {
    if (!notesData) return new Map<string, TransactionNote[]>();
    const map = new Map<string, TransactionNote[]>();
    notesData
      .filter((n) => n.parent_id)
      .forEach((n) => {
        const existing = map.get(n.parent_id!) || [];
        existing.push(n);
        map.set(n.parent_id!, existing);
      });
    return map;
  }, [notesData]);

  const handleCreate = (html: string) => {
    createMutation.mutate(
      { transaction_id: transactionId, content: html },
      {
        onSuccess: () => toast({ title: "Note added" }),
        onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-3" data-testid="card-quote-notes">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold" data-testid="text-notes-title">
          Notes
        </div>
        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-black/50" data-testid="text-notes-count">
          {topLevelNotes.length}
        </span>
      </div>

      <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1" data-testid="list-notes">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner className="h-5 w-5" />
          </div>
        ) : topLevelNotes.length === 0 ? (
          <div className="py-6 text-center text-xs text-black/40" data-testid="text-notes-empty">
            No notes yet. Add one below.
          </div>
        ) : (
          <AnimatePresence>
            {topLevelNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                replies={repliesByParent.get(note.id) || []}
                quoteId={transactionId}
                currentUserName={authorName}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="mt-2">
        <NoteEditor
          placeholder="Add a note…"
          onSubmit={handleCreate}
          isLoading={createMutation.isPending}
        />
      </div>
    </div>
  );
}
