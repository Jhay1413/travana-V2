export interface NoteAttachment {
  id: string;
  /** The note (or reply — replies are notes with a parent_id) this file belongs to. */
  noteId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
