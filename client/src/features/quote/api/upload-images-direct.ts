import rawAxios from "axios";
import axiosClient from "@/api/client/axios-client";
import { API_V2 } from "@/api/endpoints";

/**
 * Direct-to-S3 image uploads for quotes (Option A — single presigned PUT per
 * file, same pattern as the training video/thumbnail uploads in
 * client/src/features/hub/api/training.api.ts). The browser PUTs straight to
 * S3; this server never buffers the file.
 *
 * Two-step flow:
 *   1. POST /api/v2/quotes/images/presign (through the shared, authenticated
 *      axios client) — server generates the S3 key and returns a presigned
 *      uploadUrl + the stable proxyUrl to store once the PUT succeeds.
 *   2. PUT the file bytes straight to `uploadUrl` using a BARE axios instance
 *      (not the app's axios-client): the app's baseURL/withCredentials/
 *      interceptors must never touch the S3 request, and S3 would reject the
 *      app's session cookies via CORS anyway.
 */

interface PresignedUpload {
  uploadUrl: string;
  key: string;
  proxyUrl: string;
}

export interface UploadImagesDirectResult {
  proxyUrls: string[];
  failed: number;
  /**
   * Per-file mapping of the uploaded URL. `proxyUrls` alone can't be
   * index-matched back to the input because failed files are dropped from it,
   * so anything that needs to slot uploads back into a user-chosen order (see
   * the quote/booking image forms) must use this instead.
   */
  urlByFile: Map<File, string>;
}

// Kept in sync with server/v2/utils/image-storage.ts ALLOWED_IMAGE_MIME_TYPES —
// filtering client-side avoids a wasted round trip (and a confusing whole-batch
// 400) for a file the presign endpoint's zod schema would reject anyway (e.g.
// an unsupported type, or an empty File.type).
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Matches the legacy multer path's `limits: { fileSize: 5 * 1024 * 1024 }`
// (see quote.routes.ts) — a presigned PUT has no server-side size check, so
// this client-side cap is what keeps parity with that behavior.
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Upload every file directly to S3 in parallel. A file whose PUT fails is
 * dropped from `proxyUrls` and counted in `failed` — callers should still
 * proceed with whatever succeeded and surface a warning for the rest. Files
 * that fail the client-side type/size check, or the presign request itself
 * failing (e.g. network error), also degrade the same way instead of
 * throwing and aborting the whole submit.
 */
export async function uploadImagesDirect(files: File[]): Promise<UploadImagesDirectResult> {
  if (!files || files.length === 0) return { proxyUrls: [], failed: 0, urlByFile: new Map() };

  const validFiles = files.filter(
    (f) => ALLOWED_IMAGE_MIME_TYPES.has(f.type) && f.size <= MAX_IMAGE_SIZE_BYTES,
  );
  let failed = files.length - validFiles.length;

  if (validFiles.length === 0) {
    return { proxyUrls: [], failed, urlByFile: new Map() };
  }

  let presigned: PresignedUpload[];
  try {
    const { data } = await axiosClient.post<PresignedUpload[]>(
      `${API_V2}/quotes/images/presign`,
      { files: validFiles.map((f) => ({ filename: f.name, contentType: f.type })) },
    );
    presigned = data;
  } catch {
    // Presigning failed outright (validation error, network error, etc.) —
    // degrade like a per-file PUT failure rather than throwing and aborting
    // the caller's submit.
    return { proxyUrls: [], failed: failed + validFiles.length, urlByFile: new Map() };
  }

  const results = await Promise.allSettled(
    presigned.map((upload, index) =>
      rawAxios.put(upload.uploadUrl, validFiles[index], {
        headers: { "Content-Type": validFiles[index].type },
      }),
    ),
  );

  const proxyUrls: string[] = [];
  const urlByFile = new Map<File, string>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      proxyUrls.push(presigned[index].proxyUrl);
      urlByFile.set(validFiles[index], presigned[index].proxyUrl);
    } else {
      failed += 1;
    }
  });

  return { proxyUrls, failed, urlByFile };
}
