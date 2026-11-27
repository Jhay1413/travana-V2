import { useQuery } from "@tanstack/react-query";
import type { PortalDocument, PortalDocumentDownloadLink } from "@shared/portal-documents";
import { clearPortalToken, getPortalToken, portalFetch, PortalApiError } from "@/hooks/use-portal-api";
import { DocumentViewError, viewErrorKindForStatus } from "../lib/document-viewer";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";

/** Under the "portal" namespace, so signing out (which clears every ["portal", ...] query) clears these too. */
export const portalDocumentKeys = {
  list: (bookingId?: string) => ["portal", "documents", bookingId ?? "all"] as const,
};

/**
 * The files the agency linked to one of the signed-in customer's deals, newest first (files not linked to a deal are
 * never sent). With a `bookingId`: exactly the files of that booking's deal. A file's `bookingId` is its deal's live
 * booking, or null while the deal is still an enquiry or quote.
 */
export function usePortalDocuments(bookingId?: string) {
  return useQuery<PortalDocument[], PortalApiError>({
    queryKey: portalDocumentKeys.list(bookingId),
    queryFn: () =>
      portalFetch(bookingId ? `${PORTAL_ENDPOINTS.documents}?bookingId=${encodeURIComponent(bookingId)}` : PORTAL_ENDPOINTS.documents),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

const DOWNLOAD_FAILED = "We couldn't download that document. Please try again.";
const DOWNLOAD_GONE = "That document is no longer available.";

/** Starts a browser download from a link (a short-lived storage link, or an object URL for a streamed file). */
function startBrowserDownload(url: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** The name from a `Content-Disposition` header (`filename*` first), or the fallback. */
function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="([^"]*)"/i.exec(header);
  return plain?.[1] || fallback;
}

/**
 * Downloads one of the customer's documents. The portal token travels in an Authorization header, which a plain
 * `<a href>` cannot send, so this asks the server first (authenticated):
 *  - cloud-stored file: the server answers JSON `{ url, fileName, expiresInSeconds }`, a link that forces a download and
 *    works for 5 minutes; the browser is pointed at it straight away.
 *  - legacy file on the server's disk: the server answers with the file itself; it is saved from a blob.
 * Rejects with a plain-language Error; a 401 clears the session and sends the customer to sign in, like `portalFetch`.
 */
export async function downloadDocument(
  id: string,
  fallbackName = "document",
  start: (url: string, fileName: string) => void = startBrowserDownload,
): Promise<void> {
  const token = getPortalToken();
  let res: Response;
  try {
    res = await fetch(PORTAL_ENDPOINTS.documentDownload(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error(DOWNLOAD_FAILED);
  }

  if (res.status === 401) {
    clearPortalToken();
    window.location.href = "/portal/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error(DOWNLOAD_GONE);
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new Error(typeof body.error === "string" && body.error ? body.error : DOWNLOAD_FAILED);
  }

  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    const link = (await res.json()) as Partial<PortalDocumentDownloadLink>;
    if (typeof link.url !== "string" || !link.url) throw new Error(DOWNLOAD_FAILED);
    start(link.url, link.fileName || fallbackName);
    return;
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    start(objectUrl, fileNameFromDisposition(res.headers.get("content-disposition"), fallbackName));
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

/**
 * Fetches one viewable document's bytes for in-app viewing, with the portal token in the Authorization header (a plain
 * `<img src>` or `<iframe>` cannot send it). The Blob is returned to the caller, which owns it: nothing is cached in
 * React Query or any storage. Rejects with a DocumentViewError whose `kind` says what to show; a 401 clears the session
 * and sends the customer to sign in, like `downloadDocument`.
 */
export async function viewDocument(id: string, signal?: AbortSignal): Promise<Blob> {
  const token = getPortalToken();
  let res: Response;
  try {
    res = await fetch(PORTAL_ENDPOINTS.documentView(id), { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new DocumentViewError("failed");
  }
  if (res.status === 401) {
    clearPortalToken();
    window.location.href = "/portal/login";
    throw new DocumentViewError("failed", "Session expired");
  }
  if (!res.ok) throw new DocumentViewError(viewErrorKindForStatus(res.status));
  try {
    return await res.blob();
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new DocumentViewError("failed");
  }
}
