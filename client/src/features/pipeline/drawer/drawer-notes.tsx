import { useMemo } from "react";
import { NoteCards, plainTextToNoteHtml, toNoteCardItems } from "@/components/shared/note-cards";
import { useNotes } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { useCreateNote } from "@/features/note";
import { groupNotesByParent } from "@/features/note/lib/group-notes";
import { formatDate } from "@/features/pipeline/lib/pipeline-helpers";

/** Latest three deal notes as inbox-style cards, with an inline add form. */
export function DrawerNotes({ transactionId, firstName }: { transactionId: string; firstName: string }) {
  const { toast } = useToast();
  const { data: notes = [] } = useNotes(transactionId);
  const createNote = useCreateNote(transactionId);
  const items = useMemo(() => toNoteCardItems(groupNotesByParent(notes).topLevel, formatDate), [notes]);

  const save = async (content: string) => {
    try {
      await createNote.mutateAsync({ transaction_id: transactionId, content: plainTextToNoteHtml(content) });
      toast({ title: "Note added" });
    } catch (err) {
      toast({ title: "Failed to add note", variant: "destructive" });
      throw err;
    }
  };

  return (
    <NoteCards
      bare
      limit={3}
      notes={items}
      onSave={save}
      saving={createNote.isPending}
      placeholder={`A note about ${firstName}…`}
      testIdPrefix="drawer-notes"
    />
  );
}
