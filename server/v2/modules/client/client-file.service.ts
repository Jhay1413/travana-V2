import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import fs from "fs";
import { s3Client, S3_BUCKET } from "../../config/s3";
import { clientFileRepository, type ClientFileWithUploader } from "./client-file.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type { ClientFile } from "@shared/schema";

const S3_KEY_PREFIX = "client-files";
const PRESIGNED_URL_EXPIRES_IN = 60 * 5; // 5 minutes

// Legacy files were stored as bare filenames (e.g. "1748392910-123.pdf").
// S3 keys always start with the prefix "client-files/".
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads", "client-files");

function isS3Key(filename: string): boolean {
  return filename.startsWith(`${S3_KEY_PREFIX}/`);
}

export type DownloadTarget =
  | { kind: "s3"; url: string }
  | { kind: "local"; filePath: string; originalName: string; mimeType: string };

// Out-of-scope clients and files read as 404 so existence is never leaked
// across tenants.
async function assertClientInScope(clientId: string, scope: Scope): Promise<void> {
  const client = await neonClientRepository.findById(clientId, scope);
  if (!client) throw new AppError("Client not found", 404);
}

async function loadScopedFile(id: string, scope: Scope): Promise<ClientFile> {
  const file = await clientFileRepository.findById(id);
  if (!file) throw new AppError("File not found", 404);
  const client = await neonClientRepository.findById(file.clientId, scope);
  if (!client) throw new AppError("File not found", 404);
  return file;
}

export const clientFileService = {
  async listByClientId(clientId: string, scope: Scope): Promise<ClientFileWithUploader[]> {
    await assertClientInScope(clientId, scope);
    return clientFileRepository.findByClientId(clientId);
  },

  async upload(
    clientId: string,
    file: Express.Multer.File,
    meta: { title?: string; category?: string; allocationType?: string; allocationId?: string },
    scope: Scope
  ): Promise<ClientFile> {
    await assertClientInScope(clientId, scope);

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

    try {
      return await clientFileRepository.create({
        clientId,
        filename: s3Key,
        originalName: file.originalname,
        title: meta.title || file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        category: meta.category || null,
        allocationType: meta.allocationType || null,
        allocationId: meta.allocationId || null,
        uploadedBy: scope.userId,
      });
    } catch (err) {
      // Clean up S3 object if DB insert fails
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
      throw err;
    }
  },

  async getDownloadTarget(id: string, scope: Scope, opts?: { inline?: boolean }): Promise<DownloadTarget> {
    const file = await loadScopedFile(id, scope);

    // "inline" lets the browser render the file in a preview (e.g. a PDF in an
    // iframe); "attachment" forces a download.
    const disposition = opts?.inline ? "inline" : "attachment";

    if (isS3Key(file.filename)) {
      const url = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: file.filename,
          ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
          ResponseContentType: file.mimeType,
        }),
        { expiresIn: PRESIGNED_URL_EXPIRES_IN }
      );
      return { kind: "s3", url };
    }

    // Legacy local file
    const filePath = path.join(LOCAL_UPLOADS_DIR, file.filename);
    if (!fs.existsSync(filePath)) {
      throw new AppError("File not found on disk", 404);
    }
    return { kind: "local", filePath, originalName: file.originalName, mimeType: file.mimeType };
  },

  async delete(id: string, scope: Scope): Promise<void> {
    const file = await loadScopedFile(id, scope);

    if (isS3Key(file.filename)) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: file.filename }));
    } else {
      // Legacy local file — remove from disk if it still exists
      const filePath = path.join(LOCAL_UPLOADS_DIR, file.filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    }

    await clientFileRepository.remove(id);
  },
};
