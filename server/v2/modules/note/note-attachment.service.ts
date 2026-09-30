import path from "path";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "../../config/s3";
import { noteAttachmentRepository } from "./note-attachment.repository";
import { noteRepository } from "./note.repository";
import { AppError } from "../../utils/error-handler";
import type { NoteAttachment } from "@shared/schema";
import type { Scope } from "../../utils/scope";
import type { NoteAttachmentUpload, NoteAttachmentDownloadTarget } from "./note-attachment.types";

// Note attachments live in S3 under "note-attachments/". There are no legacy
// local-disk rows for this table, so every filename is an S3 key.
const S3_KEY_PREFIX = "note-attachments";
const PRESIGNED_URL_EXPIRES_IN = 60 * 5; // 5 minutes

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === "platform_admin") return null;
  return (scope as Scope).orgId || null;
}

// Same rule the note service applies: a note is in scope when the client it
// belongs to (directly, or via its transaction) is in the caller's org.
// Replies are notes too, so this covers them.
async function assertNoteInScope(noteId: string, scope: ScopeOrTrusted): Promise<void> {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const note = await noteRepository.findById(noteId);
    if (!note) throw new AppError("Note not found", 404);
    return;
  }
  const row = await noteRepository.findByIdWithOrg(noteId);
  if (!row || row.orgId !== orgId) throw new AppError("Note not found", 404);
}

async function assertTransactionInScope(transactionId: string, scope: ScopeOrTrusted): Promise<void> {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await noteRepository.transactionBelongsToOrg(transactionId, orgId);
  if (!ok) throw new AppError("Attachments not found", 404);
}

async function loadScopedAttachment(id: string, scope: ScopeOrTrusted): Promise<NoteAttachment> {
  const attachment = await noteAttachmentRepository.findById(id);
  if (!attachment) throw new AppError("Attachment not found", 404);
  try {
    await assertNoteInScope(attachment.noteId, scope);
  } catch {
    // Don't reveal that an out-of-scope attachment exists.
    throw new AppError("Attachment not found", 404);
  }
  return attachment;
}

async function uploadOne(noteId: string, file: NoteAttachmentUpload): Promise<NoteAttachment> {
  const ext = path.extname(file.originalName) || "";
  const s3Key = `${S3_KEY_PREFIX}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimeType,
      ContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    }),
  );

  try {
    return await noteAttachmentRepository.create({
      noteId,
      filename: s3Key,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    });
  } catch (err) {
    // No orphan object if the row could not be recorded.
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
    throw err;
  }
}

export const noteAttachmentService = {
  async listByNoteId(noteId: string, scope: ScopeOrTrusted): Promise<NoteAttachment[]> {
    await assertNoteInScope(noteId, scope);
    return noteAttachmentRepository.findByNoteId(noteId);
  },

  async listByTransactionId(transactionId: string, scope: ScopeOrTrusted): Promise<NoteAttachment[]> {
    await assertTransactionInScope(transactionId, scope);
    return noteAttachmentRepository.findByTransactionId(transactionId);
  },

  // Uploads each file's bytes to S3, then records its row (filename = the S3 key).
  async uploadMany(noteId: string, files: NoteAttachmentUpload[], scope: ScopeOrTrusted): Promise<NoteAttachment[]> {
    if (files.length === 0) throw new AppError("No file uploaded", 400);
    // Check scope once up front so an out-of-scope note fails before any S3 write.
    await assertNoteInScope(noteId, scope);
    const created: NoteAttachment[] = [];
    for (const file of files) {
      created.push(await uploadOne(noteId, file));
    }
    return created;
  },

  async getDownloadTarget(
    id: string,
    scope: ScopeOrTrusted,
    opts?: { inline?: boolean },
  ): Promise<NoteAttachmentDownloadTarget> {
    const attachment = await loadScopedAttachment(id, scope);
    const disposition = opts?.inline ? "inline" : "attachment";
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: attachment.filename,
        ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
        ResponseContentType: attachment.mimeType,
      }),
      { expiresIn: PRESIGNED_URL_EXPIRES_IN },
    );
    return { kind: "s3", url };
  },

  async deleteAttachment(id: string, scope: ScopeOrTrusted): Promise<NoteAttachment> {
    const attachment = await loadScopedAttachment(id, scope);
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: attachment.filename }));
    await noteAttachmentRepository.remove(id);
    return attachment;
  },
};
