import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useClientNotes } from "@/hooks/queries";
import { useCreateClientNote } from "@/features/note";
import { formatClientDate } from "../../client-link-section";
import { Section, SECTION_ACTION_CLASS } from "./section";

interface NotesSectionProps {
  clientId: string;
  firstName: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function NotesSection({ clientId, firstName }: NotesSectionProps) {
  const { toast } = useToast();
  const { data: notes = [] } = useClientNotes(clientId);
  const createNote = useCreateClientNote(clientId);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const save = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      await createNote.mutateAsync({ content });
      toast({ title: "Note added" });
      setDraft("");
      setAdding(false);
    } catch (err) {
      toast({ title: "Couldn't add note", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <Section
      title="Notes"
      data-testid="client-notes"
      action={
        <button
          type="button"
          className={SECTION_ACTION_CLASS}
          onClick={() => setAdding((v) => !v)}
          data-testid="client-notes-toggle"
        >
          {adding ? "Cancel" : "Add"}
        </button>
      }
    >
      {adding && (
        <div className="mb-3 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`A note about ${firstName}…`}
            rows={3}
            className="min-h-0 text-[13px]"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={!draft.trim() || createNote.isPending}
              className="h-[34px] rounded-[10px] bg-social-orange px-3.5 text-[13px] font-semibold text-[#1F2937] disabled:opacity-50"
            >
              Save note
            </button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <p className="text-[13px] text-social-muted">No notes yet</p>
      ) : (
        <div>
          {notes.map((n) => (
            <div key={n.id} className="mb-2 rounded-[10px] bg-[#FFFBEB] px-3 py-2.5 text-[13px] leading-[1.55] dark:bg-amber-950/30">
              <p className="whitespace-pre-wrap">{stripHtml(n.content || n.description || "")}</p>
              <div className="text-[12px] text-social-muted">
                {n.author_name || "Note"} · {formatClientDate(n.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
