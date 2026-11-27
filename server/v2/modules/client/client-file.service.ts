import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { s3Client, S3_BUCKET } from "../../config/s3";
import { clientFileRepository, type ClientFileWithUploader } from "./client-file.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { AppError } from "../../utils/error-handler";
import { canReadDeletedClients } from "../../utils/client-delete-roles";
import type { Scope } from "../../utils/scope";
import type { ClientFile } from "@shared/schema";

const S3_KEY_PREFIX = "client-files";
export const PRESIGNED_URL_EXPIRES_IN = 60 * 5; // 5 minutes

// Legacy files were stored as bare filenames (e.g. "1748392910-123.pdf").
// S3 keys always start with the prefix "client-files/".
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads", "client-files");

/**
 * The legacy disk path for a stored filename, or null when it would escape the uploads directory (a "../" name or an
 * absolute path). Nothing outside the directory is ever read or deleted.
 */
export function resolveLocalUploadPath(filename: string): string | null {
  const root = path.resolve(LOCAL_UPLOADS_DIR);
  const resolved = path.resolve(root, filename);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

const ALLOCATION_KINDS = { booking: "booking", quote: "quote", enquiry: "enquiry" } as const;

/**
 * A file may be linked to a booking, quote or enquiry only when the id is a real record of that kind on THIS client
 * (the client itself is already known to be in the caller's agency). "None" or blank means not linked.
 */
async function assertAllocationValid(clientId: string, type?: string, id?: string): Promise<void> {
  const normalised = (type ?? "").trim().toLowerCase();
  if (normalised === "" || normalised === "none") return;
  const kind = ALLOCATION_KINDS[normalised as keyof typeof ALLOCATION_KINDS];
  const recordId = (id ?? "").trim();
  if (!kind || !recordId) throw new AppError("Choose the booking, quote or enquiry to link this file to", 400);
  if (!(await clientFileRepository.recordBelongsToClient(kind, recordId, clientId))) {
    throw new AppError("That booking, quote or enquiry does not belong to this client", 400);
  }
}

function isS3Key(filename: string): boolean {
  return filename.startsWith(`${S3_KEY_PREFIX}/`);
}

export type DownloadTarget =
  | { kind: "s3"; url: string }
  | { kind: "local"; filePath: string; originalName: string; mimeType: string };

/** The first bytes of a stored object and its full size, for sniffing a type before anything is streamed. */
export interface ObjectHead {
  head: Buffer;
  size: number;
}

/** A stored object opened for reading. `size` is the exact byte length when the store reported it. */
export interface ObjectStream {
  stream: Readable;
  size: number | null;
}

const NOT_FOUND_ON_STORE = new Set(["NoSuchKey", "NotFound", "NoSuchBucket"]);

function isNotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const named = err as { name?: unknown; $metadata?: { httpStatusCode?: number } };
  return (typeof named.name === "string" && NOT_FOUND_ON_STORE.has(named.name)) || named.$metadata?.httpStatusCode === 404;
}

// Out-of-scope clients and files read as 404 so existence is never leaked
// across tenants.
async function assertClientInScope(clientId: string, scope: Scope, opts?: { forRead?: boolean }): Promise<void> {
  // Reads of a soft-deleted client are allowed for admins only; uploads keep the strict lookup.
  const client = opts?.forRead && canReadDeletedClients(scope)
    ? await neonClientRepository.findByIdIncludingDeleted(clientId, scope)
    : await neonClientRepository.findById(clientId, scope);
  if (!client) throw new AppError("Client not found", 404);
}

async function loadScopedFile(id: string, scope: Scope, opts?: { forRead?: boolean }): Promise<ClientFile> {
  const file = await clientFileRepository.findById(id);
  if (!file) throw new AppError("File not found", 404);
  const client = opts?.forRead && canReadDeletedClients(scope)
    ? await neonClientRepository.findByIdIncludingDeleted(file.clientId, scope)
    : await neonClientRepository.findById(file.clientId, scope);
  if (!client) throw new AppError("File not found", 404);
  return file;
}

export const clientFileService = {
  async listByClientId(clientId: string, scope: Scope): Promise<ClientFileWithUploader[]> {
    await assertClientInScope(clientId, scope, { forRead: true });
    return clientFileRepository.findByClientId(clientId);
  },

  async upload(
    clientId: string,
    file: Express.Multer.File,
    meta: { title?: string; category?: string; allocationType?: string; allocationId?: string },
    scope: Scope
  ): Promise<ClientFile> {
    await assertClientInScope(clientId, scope);
    await assertAllocationValid(clientId, meta.allocationType, meta.allocationId);

    const ext = path.extname(file.originalname);
    const s3Key = `${S3_KEY_PREFIX}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalname)}`,
      })
    );

    const allocationType = meta.allocationType && meta.allocationType.trim() !== "" ? meta.allocationType : null;

    try {
      return await clientFileRepository.create({
        clientId,
        filename: s3Key,
        originalName: file.originalname,
        title: meta.title || file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        category: meta.category || null,
        allocationType,
        allocationId: allocationType === null ? null : meta.allocationId?.trim() || null,
        uploadedBy: scope.userId,
      });
    } catch (err) {
      // Clean up S3 object if DB insert fails
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
      throw err;
    }
  },

  async getDownloadTarget(id: string, scope: Scope, opts?: { inline?: boolean }): Promise<DownloadTarget> {
    const file = await loadScopedFile(id, scope, { forRead: true });
    return clientFileService.resolveDownloadTarget(file, opts);
  },

  /**
   * Turns an already-authorised file row into a download target (a short-lived signed URL for S3 files, a path for
   * legacy local ones). The caller is responsible for the access check. `contentDisposition` and `contentType` let a
   * caller (the customer portal) force its own safe headers on the signed URL instead of the stored ones.
   */
  async resolveDownloadTarget(
    file: Pick<ClientFile, "filename" | "originalName" | "mimeType">,
    opts?: { inline?: boolean; contentDisposition?: string; contentType?: string },
  ): Promise<DownloadTarget> {
    // "inline" lets the browser render the file in a preview (e.g. a PDF in an
    // iframe); "attachment" forces a download.
    const disposition = opts?.inline ? "inline" : "attachment";

    if (isS3Key(file.filename)) {
      const url = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: file.filename,
          ResponseContentDisposition:
            opts?.contentDisposition ?? `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
          ResponseContentType: opts?.contentType ?? file.mimeType,
        }),
        { expiresIn: PRESIGNED_URL_EXPIRES_IN }
      );
      return { kind: "s3", url };
    }

    // Legacy local file
    const filePath = resolveLocalUploadPath(file.filename);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new AppError("File not found on disk", 404);
    }
    return { kind: "local", filePath, originalName: file.originalName, mimeType: file.mimeType };
  },

  /**
   * The first `bytes` bytes of an already-authorised file plus its total size (a ranged read for object storage, a
   * short read for a legacy disk file). 404 when the object or file is gone. The caller does the access check.
   */
  async readObjectHead(file: Pick<ClientFile, "filename">, bytes: number): Promise<ObjectHead> {
    if (isS3Key(file.filename)) {
      try {
        const res = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: file.filename, Range: `bytes=0-${bytes - 1}` }));
        const head = res.Body ? Buffer.from(await res.Body.transformToByteArray()) : Buffer.alloc(0);
        const total = /\/(\d+)$/.exec(res.ContentRange ?? "");
        return { head, size: total ? Number(total[1]) : (res.ContentLength ?? head.length) };
      } catch (err) {
        if (isNotFound(err)) throw new AppError("File not found", 404);
        // A zero-byte object cannot satisfy a range: it is simply empty.
        if (typeof err === "object" && err !== null && (err as { name?: unknown }).name === "InvalidRange") {
          return { head: Buffer.alloc(0), size: 0 };
        }
        throw err;
      }
    }
    const filePath = resolveLocalUploadPath(file.filename);
    if (!filePath) throw new AppError("File not found on disk", 404);
    let handle: fs.promises.FileHandle;
    try {
      handle = await fs.promises.open(filePath, "r");
    } catch {
      throw new AppError("File not found on disk", 404);
    }
    try {
      const { size } = await handle.stat();
      const buffer = Buffer.alloc(Math.min(bytes, size));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return { head: buffer.subarray(0, bytesRead), size };
    } finally {
      await handle.close();
    }
  },

  /**
   * Opens an already-authorised file as a byte stream for the server to relay (no signed URL leaves the server). The
   * caller owns the stream: it must be piped or destroyed. Aborting `signal` cancels the upstream read.
   */
  async openObjectStream(file: Pick<ClientFile, "filename">, signal?: AbortSignal): Promise<ObjectStream> {
    if (isS3Key(file.filename)) {
      try {
        const res = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: file.filename }), { abortSignal: signal });
        if (!(res.Body instanceof Readable)) throw new Error("Object storage returned a body that cannot be streamed");
        return { stream: res.Body, size: res.ContentLength ?? null };
      } catch (err) {
        if (isNotFound(err)) throw new AppError("File not found", 404);
        throw err;
      }
    }
    const filePath = resolveLocalUploadPath(file.filename);
    if (!filePath) throw new AppError("File not found on disk", 404);
    let size: number;
    try {
      size = (await fs.promises.stat(filePath)).size;
    } catch {
      throw new AppError("File not found on disk", 404);
    }
    return { stream: fs.createReadStream(filePath), size };
  },

  async delete(id: string, scope: Scope): Promise<void> {
    const file = await loadScopedFile(id, scope);

    if (isS3Key(file.filename)) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: file.filename }));
    } else {
      // Legacy local file — remove from disk if it still exists
      const filePath = resolveLocalUploadPath(file.filename);
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    }

    await clientFileRepository.remove(id);
  },
};
