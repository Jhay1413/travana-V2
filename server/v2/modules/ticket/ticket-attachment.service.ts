import fs from "fs";
import path from "path";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "../../config/s3";
import { ticketAttachmentRepository } from './ticket-attachment.repository';
import { AppError } from '../../utils/error-handler';
import type { TicketAttachment, InsertTicketAttachment } from '@shared/schema';
import type { Scope } from '../../utils/scope';

// Ticket attachments are stored in S3 under "ticket-attachments/". Legacy rows
// created before this migration hold a bare local filename (in uploads/) — they
// remain READABLE via the local-disk fallback, but all new uploads go to S3.
const S3_KEY_PREFIX = "ticket-attachments";
const PRESIGNED_URL_EXPIRES_IN = 60 * 5; // 5 minutes
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");

function isS3Key(filename: string): boolean {
  return filename.startsWith(`${S3_KEY_PREFIX}/`);
}

export type TicketAttachmentDownloadTarget =
  | { kind: "s3"; url: string }
  | { kind: "local"; filePath: string; originalName: string; mimeType: string };

export interface TicketAttachmentUpload {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === 'platform_admin') return null;
  return (scope as Scope).orgId || null;
}

async function assertTicketInScope(ticketId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await ticketAttachmentRepository.ticketBelongsToOrg(ticketId, orgId);
  if (!ok) throw new AppError('Attachment not found', 404);
}

async function loadScopedAttachment(id: string, scope: ScopeOrTrusted): Promise<TicketAttachment> {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const a = await ticketAttachmentRepository.findById(id);
    if (!a) throw new AppError('Attachment not found', 404);
    return a;
  }
  const row = await ticketAttachmentRepository.findByIdWithOrg(id);
  if (!row || row.ticketOrgId !== orgId) {
    throw new AppError('Attachment not found', 404);
  }
  const a = await ticketAttachmentRepository.findById(id);
  if (!a) throw new AppError('Attachment not found', 404);
  return a;
}

export const ticketAttachmentService = {
  async listByTicketId(ticketId: string, scope: ScopeOrTrusted): Promise<TicketAttachment[]> {
    await assertTicketInScope(ticketId, scope);
    return ticketAttachmentRepository.findByTicketId(ticketId);
  },

  async getAttachmentById(id: string, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    return loadScopedAttachment(id, scope);
  },

  async createAttachment(data: InsertTicketAttachment, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    await assertTicketInScope(data.ticketId, scope);
    return ticketAttachmentRepository.create(data);
  },

  // Uploads the file bytes to S3, then records the attachment row (filename =
  // the S3 key). Used by both the staff upload endpoint and the AI admin bot.
  // On DB failure the S3 object is cleaned up so no orphan is left behind.
  async uploadAndCreate(ticketId: string, file: TicketAttachmentUpload, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    await assertTicketInScope(ticketId, scope);
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
      return await ticketAttachmentRepository.create({
        ticketId,
        filename: s3Key,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      });
    } catch (err) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
      throw err;
    }
  },

  // Resolves how to serve an attachment: a short-lived S3 URL (new files) or a
  // local disk path (legacy files stored before the S3 migration).
  async getDownloadTarget(
    id: string,
    scope: ScopeOrTrusted,
    opts?: { inline?: boolean },
  ): Promise<TicketAttachmentDownloadTarget> {
    const attachment = await loadScopedAttachment(id, scope);
    const disposition = opts?.inline ? "inline" : "attachment";

    if (isS3Key(attachment.filename)) {
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
    }

    const filePath = path.join(LOCAL_UPLOADS_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) throw new AppError('File not found on disk', 404);
    return { kind: "local", filePath, originalName: attachment.originalName, mimeType: attachment.mimeType };
  },

  async deleteAttachment(id: string, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    const attachment = await loadScopedAttachment(id, scope);
    if (isS3Key(attachment.filename)) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: attachment.filename }));
    } else {
      const filePath = path.join(LOCAL_UPLOADS_DIR, attachment.filename);
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    }
    await ticketAttachmentRepository.remove(id);
    return attachment;
  },
};
