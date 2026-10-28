import type { NoteAttachment } from "../types";

/** Buckets attachments by the note they belong to, preserving input order within each note. */
export function groupAttachmentsByNote(attachments: readonly NoteAttachment[]): Map<string, NoteAttachment[]> {
  const byNote = new Map<string, NoteAttachment[]>();
  for (const attachment of attachments) {
    const list = byNote.get(attachment.noteId);
    if (list) list.push(attachment);
    else byNote.set(attachment.noteId, [attachment]);
  }
  return byNote;
}
