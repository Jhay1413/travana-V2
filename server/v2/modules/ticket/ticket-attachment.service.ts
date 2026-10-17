import fs from "fs";
import path from "path";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "../../config/s3";
import { ticketAttachmentRepository } from './ticket-attachment.repository';
import { ticketReplyRepository } from './ticket-reply.repository';
import { AppError } from '../../utils/error-handler';
import type { TicketAttachment, InsertTicketAttachment } from '@shared/schema';
import type { OrgRole, Scope } from '../../utils/scope';
import type { ScopeOrTrusted } from '../../utils/scope-conditions';
import { ticketRepository } from './ticket.repository';
import type { TicketScopeRef } from './ticket.types';

// Ticket attachments are stored in S3 under "ticket-attachments/". Legacy rows
// created before this migration hold a bare local filename (in uploads/) — they
// remain READABLE via the local-disk fallback, but all new uploads go to S3.
const S3_KEY_PREFIX = "ticket-attachments";
const PRESIGNED_URL_EXPIRES_IN = 60 * 5; // 5 minutes
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Resolves a legacy local filename inside uploads/ only; anything that escapes
// the directory (../ or an absolute path) yields null.
function resolveLocalPath(filename: string): string | null {
  const resolved = path.resolve(LOCAL_UPLOADS_DIR, filename);
  return resolved.startsWith(path.resolve(LOCAL_UPLOADS_DIR) + path.sep) ? resolved : null;
}

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
  /** Attach to one of the ticket's replies instead of the ticket itself. */
  replyId?: string | null;
}

const ATTACHMENT_ADMIN_ROLES: OrgRole[] = ['branch_manager', 'org_admin', 'platform_admin'];

/** The ticket, only if the caller may act on it under the ticket's own scope rules. */
async function requireTicket(ticketId: string, scope: ScopeOrTrusted): Promise<TicketScopeRef> {
  const ticket = await ticketRepository.findByIdScoped(ticketId, scope);
  if (!ticket) throw new AppError('Ticket not found', 404);
  return ticket;
}

async function loadScopedAttachment(
  id: string,
  scope: ScopeOrTrusted,
): Promise<{ attachment: TicketAttachment; ticket: TicketScopeRef }> {
  const attachment = await ticketAttachmentRepository.findById(id);
  if (!attachment) throw new AppError('Attachment not found', 404);
  const ticket = await ticketRepository.findByIdScoped(attachment.ticketId, scope);
  if (!ticket) throw new AppError('Attachment not found', 404);
  return { attachment, ticket };
}

/**
 * Who may delete an attachment, given the caller can already see its ticket:
 * the reply's author for a reply file, the ticket's raiser for a ticket-level
 * file, plus branch_manager / org_admin / platform_admin (their reach is
 * already bounded by the ticket scope). Trusted internal callers always may.
 */
export function canDeleteAttachment(args: {
  attachment: Pick<TicketAttachment, 'replyId'>;
  ticket: Pick<TicketScopeRef, 'userId'>;
  replyAuthorId: string | null;
  scope: ScopeOrTrusted;
}): boolean {
  const { attachment, ticket, replyAuthorId, scope } = args;
  if (scope.orgId === null) return true;
  const s = scope as Scope;
  if (ATTACHMENT_ADMIN_ROLES.includes(s.orgRole)) return true;
  if (!s.userId) return false;
  if (attachment.replyId) return replyAuthorId === s.userId;
  return ticket.userId === s.userId;
}

export const ticketAttachmentService = {
  async listByTicketId(ticketId: string, scope: ScopeOrTrusted): Promise<TicketAttachment[]> {
    await requireTicket(ticketId, scope);
    return ticketAttachmentRepository.findByTicketId(ticketId);
  },

  async getAttachmentById(id: string, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    const { attachment } = await loadScopedAttachment(id, scope);
    return attachment;
  },

  async createAttachment(data: InsertTicketAttachment, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    await requireTicket(data.ticketId, scope);
    return ticketAttachmentRepository.create(data);
  },

  // Uploads the file bytes to S3, then records the attachment row (filename =
  // the S3 key). Used by both the staff upload endpoint and the AI admin bot.
  // On DB failure the S3 object is cleaned up so no orphan is left behind.
  async uploadAndCreate(ticketId: string, file: TicketAttachmentUpload, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    await requireTicket(ticketId, scope);
    // A reply-level attachment must hang off a reply on this same ticket.
    const replyId = file.replyId || null;
    if (replyId) {
      const reply = await ticketReplyRepository.findById(replyId);
      if (!reply || reply.ticketId !== ticketId) {
        throw new AppError("Reply does not belong to this ticket", 400);
      }
      if (scope.orgId !== null && reply.userId !== (scope as Scope).userId) {
        throw new AppError("You can only attach files to your own replies", 403);
      }
    }
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
        replyId,
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
    const { attachment } = await loadScopedAttachment(id, scope);
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

    const filePath = resolveLocalPath(attachment.filename);
    if (!filePath || !fs.existsSync(filePath)) throw new AppError('File not found on disk', 404);
    return { kind: "local", filePath, originalName: attachment.originalName, mimeType: attachment.mimeType };
  },

  async deleteAttachment(id: string, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    const { attachment, ticket } = await loadScopedAttachment(id, scope);
    const replyAuthorId = attachment.replyId
      ? ((await ticketReplyRepository.findById(attachment.replyId))?.userId ?? null)
      : null;
    if (!canDeleteAttachment({ attachment, ticket, replyAuthorId, scope })) {
      throw new AppError('You can only delete attachments you added', 403);
    }
    // Row first: a storage hiccup must never leave a row pointing at a half-deleted file.
    await ticketAttachmentRepository.remove(id);
    try {
      if (isS3Key(attachment.filename)) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: attachment.filename }));
      } else {
        const filePath = resolveLocalPath(attachment.filename);
        if (filePath && fs.existsSync(filePath)) await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.warn(`[tickets] attachment ${id} row removed but file cleanup failed:`, err);
    }
    return attachment;
  },
};
