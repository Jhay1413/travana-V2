export const NOTE_ATTACHMENT_ALLOWED_MIME_TYPES = [
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
] as const;

export const NOTE_ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
export const NOTE_ATTACHMENT_MAX_FILES = 10; // per upload request

export interface NoteAttachmentUpload {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export type NoteAttachmentDownloadTarget = { kind: "s3"; url: string };
