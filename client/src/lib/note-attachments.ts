// Client-side mirror of the server's note-attachment rules
// (server/v2/modules/note/note-attachment.types.ts). The server is the
// authority; this only lets the composer reject a bad file before the upload.

export const NOTE_ATTACHMENT_ALLOWED_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

/** Value for the file input's `accept` attribute. */
export const NOTE_ATTACHMENT_ACCEPT = NOTE_ATTACHMENT_ALLOWED_TYPES.join(",");

export const NOTE_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const NOTE_ATTACHMENT_MAX_FILES = 10;

export interface NoteAttachmentFilterResult {
  accepted: File[];
  /** Human-readable reasons, one per rejected file. */
  rejected: string[];
}

/** Splits picked files into those the server will accept and reasons for the rest. */
export function filterNoteAttachmentFiles(incoming: File[], alreadyPending: number): NoteAttachmentFilterResult {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of incoming) {
    if (!NOTE_ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
      rejected.push(`${file.name}: unsupported file type`);
    } else if (file.size > NOTE_ATTACHMENT_MAX_SIZE) {
      rejected.push(`${file.name}: file too large (max 10MB)`);
    } else if (alreadyPending + accepted.length >= NOTE_ATTACHMENT_MAX_FILES) {
      rejected.push(`${file.name}: too many files (max ${NOTE_ATTACHMENT_MAX_FILES})`);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
