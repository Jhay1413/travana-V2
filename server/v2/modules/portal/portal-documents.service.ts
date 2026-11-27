import type { PortalDocument } from '@shared/portal-documents';
import { AppError } from '../../utils/error-handler';
import { clientFileService, PRESIGNED_URL_EXPIRES_IN } from '../client/client-file.service';
import { attachmentDisposition, isUuid, matchesSignature, safeContentType, sanitiseFileName, toPortalDocument, viewTypeFor } from './portal-documents.mapper';
import { portalDocumentsRepository } from './portal-documents.repository';
import type { PortalDownload, PortalLinkedFileRow, PortalViewStream } from './portal-documents.types';

const NOT_FOUND_MESSAGE = 'Document not found';

/** The largest file the in-app viewer will relay; anything bigger is download-only. */
export const MAX_VIEW_BYTES = 25 * 1024 * 1024;
/** Enough leading bytes to recognise every signature the viewer accepts. */
const SIGNATURE_BYTES = 16;
const TOO_LARGE_MESSAGE = 'This file is too large to preview. Please download it.';
const NOT_VIEWABLE_MESSAGE = "This document can't be previewed. Please download it.";

interface VisibleFile {
  file: PortalLinkedFileRow;
  bookingId: string | null;
}

/**
 * THE visibility rule, shared by the list and the download. The repository join keeps only files linked (Booking, Quote
 * or Enquiry) to a deal of THIS customer that is not a test deal; "None", blank, old placeholder ids and other
 * customers' records never join. On top of that, a deal whose booking is no longer live (LOST or inactive booking) is
 * hidden like the booking itself; a deal with no booking yet (enquiry or quote stage) is shown with a null bookingId;
 * a live booking stays visible even when its deal was deactivated.
 */
async function loadVisible(clientId: string, fileId?: string): Promise<VisibleFile[]> {
  const files = await portalDocumentsRepository.findVisibleFiles(clientId, fileId);
  const dealIds = Array.from(new Set(files.map((f) => f.dealId)));
  const [live, anyBooking] = await Promise.all([
    portalDocumentsRepository.findLiveBookingsByDeal(clientId, dealIds),
    portalDocumentsRepository.findDealIdsWithAnyBooking(clientId, dealIds),
  ]);
  const liveBookingByDeal = new Map(live.map((b) => [b.dealId, b.bookingId]));
  const hasBooking = new Set(anyBooking);

  const visible: VisibleFile[] = [];
  for (const file of files) {
    const bookingId = liveBookingByDeal.get(file.dealId) ?? null;
    if (bookingId === null && hasBooking.has(file.dealId)) continue;
    visible.push({ file, bookingId });
  }
  return visible;
}

export const portalDocumentsService = {
  /**
   * The files the agency linked to one of the customer's deals, newest first. With a `bookingId` filter: exactly the
   * files whose deal is that booking's deal (a booking that is not theirs or not live matches nothing).
   */
  async list(clientId: string, filterBookingId?: string): Promise<PortalDocument[]> {
    const visible = await loadVisible(clientId);
    return visible
      .filter((v) => !filterBookingId || v.bookingId === filterBookingId)
      .map((v) => toPortalDocument(v.file, v.bookingId));
  },

  /**
   * How to hand the customer one of their own files. Anything that is not visible in the list (another customer's file,
   * an unknown or malformed id, a file not linked to a deal) is the same 404. Headers are forced safe: attachment, a
   * sanitised name, and a mime type only from the safe list.
   */
  async getDownload(clientId: string, fileId: string): Promise<PortalDownload> {
    if (!isUuid(fileId)) throw new AppError(NOT_FOUND_MESSAGE, 404);
    const [match] = await loadVisible(clientId, fileId);
    if (!match) throw new AppError(NOT_FOUND_MESSAGE, 404);
    const { file } = match;

    const fileName = sanitiseFileName(file.originalName);
    const contentType = safeContentType(file.mimeType);
    const contentDisposition = attachmentDisposition(fileName);

    let target;
    try {
      target = await clientFileService.resolveDownloadTarget(file, { contentDisposition, contentType });
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 404) throw new AppError(NOT_FOUND_MESSAGE, 404);
      throw err;
    }

    // No audit table fits (audit_log records staff deletions), so a download leaves a structured log line. Ids only:
    // never the signed URL.
    console.info(`[portal] document download client=${clientId} file=${file.id}`);

    if (target.kind === 's3') {
      return { kind: 'link', url: target.url, fileName, expiresInSeconds: PRESIGNED_URL_EXPIRES_IN };
    }
    return { kind: 'stream', filePath: target.filePath, fileName, contentType, contentDisposition };
  },

  /**
   * Opens one of the customer's own files for in-app viewing. Same visibility rule and same 404 as the download. Only a
   * PDF or common image whose stored type and extension agree, whose first bytes really are that type, and which is
   * within the size ceiling is relayed. The caller must pipe (or destroy) the returned stream.
   */
  async getView(clientId: string, fileId: string, signal?: AbortSignal): Promise<PortalViewStream> {
    if (!isUuid(fileId)) throw new AppError(NOT_FOUND_MESSAGE, 404);
    const [match] = await loadVisible(clientId, fileId);
    if (!match) throw new AppError(NOT_FOUND_MESSAGE, 404);
    const { file } = match;

    const view = viewTypeFor(file.mimeType, file.originalName);
    if (!view) throw new AppError(NOT_VIEWABLE_MESSAGE, 415);
    if (file.size > MAX_VIEW_BYTES) throw new AppError(TOO_LARGE_MESSAGE, 413);

    const gone = <T>(run: Promise<T>): Promise<T> =>
      run.catch((err: unknown) => {
        if (err instanceof AppError && err.statusCode === 404) throw new AppError(NOT_FOUND_MESSAGE, 404);
        throw err;
      });

    const { head, size } = await gone(clientFileService.readObjectHead(file, SIGNATURE_BYTES));
    if (size > MAX_VIEW_BYTES) throw new AppError(TOO_LARGE_MESSAGE, 413);
    if (!matchesSignature(view.contentType, head)) throw new AppError(NOT_VIEWABLE_MESSAGE, 415);

    const opened = await gone(clientFileService.openObjectStream(file, signal));
    // Ids only: never the file name or any storage location.
    console.info(`[portal] document view client=${clientId} file=${file.id}`);
    return { stream: opened.stream, contentType: view.contentType, fileName: sanitiseFileName(file.originalName), size: opened.size };
  },
};
