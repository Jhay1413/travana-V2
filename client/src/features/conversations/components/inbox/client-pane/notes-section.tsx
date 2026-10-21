import { useToast } from "@/hooks/use-toast";
import { useClientNotes } from "@/hooks/queries";
import { useCreateClientNote } from "@/features/note";
import { NoteCards, plainTextToNoteHtml, toNoteCardItems } from "@/components/shared/note-cards";
import { formatClientDate } from "../../client-link-section";
import { Section } from "./section";

interface NotesSectionProps {
  clientId: string;
  firstName: string;
}

export function NotesSection({ clientId, firstName }: NotesSectionProps) {
  const { toast } = useToast();
  const { data: notes = [] } = useClientNotes(clientId);
  const createNote = useCreateClientNote(clientId);

  const save = async (content: string) => {
    try {
      await createNote.mutateAsync({ content: plainTextToNoteHtml(content) });
      toast({ title: "Note added" });
    } catch (err) {
      toast({ title: "Couldn't add note", description: (err as Error).message, variant: "destructive" });
      throw err;
    }
  };

  return (
    <Section title="Notes" data-testid="client-notes">
      <NoteCards
        bare
        notes={toNoteCardItems(notes, formatClientDate)}
        onSave={save}
        saving={createNote.isPending}
        placeholder={`A note about ${firstName}…`}
        testIdPrefix="client-notes"
      />
    </Section>
  );
}
