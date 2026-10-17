import { NoteEditor } from "@/components/shared/note-editor";

/**
 * Inline editor for one post. Descriptions are rich-text HTML (from the create
 * dialog) and replies may be plain text; the shared note editor handles both
 * and hands back HTML, which is what the thread renders.
 */
export function NoteEditForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div data-testid="ticket-note-edit">
      <NoteEditor initialContent={initial} submitLabel="Save" compact isLoading={isSaving} onSubmit={onSave} onCancel={onCancel} />
    </div>
  );
}
