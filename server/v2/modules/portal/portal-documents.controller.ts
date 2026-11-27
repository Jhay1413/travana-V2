import type { Response } from 'express';
import { pipeline } from 'stream/promises';
import type { PortalDocumentDownloadLink } from '@shared/portal-documents';
import { handleAuthed } from './portal-handlers';
import { inlineDisposition } from './portal-documents.mapper';
import { portalDocumentsService } from './portal-documents.service';

/** Headers for every download answer: never cached, never type-sniffed. */
function setPrivateHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export const portalDocumentsController = {
  list: handleAuthed('Failed to load your documents', async (req, res) => {
    const bookingId = typeof req.query.bookingId === 'string' ? req.query.bookingId : undefined;
    setPrivateHeaders(res);
    res.json(await portalDocumentsService.list(req.portalClient.clientId, bookingId));
  }),

  download: handleAuthed('Failed to prepare your download', async (req, res) => {
    const result = await portalDocumentsService.getDownload(req.portalClient.clientId, String(req.params.id));
    setPrivateHeaders(res);
    if (result.kind === 'link') {
      const link: PortalDocumentDownloadLink = { url: result.url, fileName: result.fileName, expiresInSeconds: result.expiresInSeconds };
      res.json(link);
      return;
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', result.contentDisposition);
    await new Promise<void>((resolve, reject) => {
      res.sendFile(result.filePath, { cacheControl: false }, (err) => (err ? reject(err) : resolve()));
    });
  }),

  /**
   * Relays one viewable file to the signed-in customer's browser (it fetches with its Bearer token and renders a Blob).
   * Locked down so that even if the response were opened directly nothing in it could run or be embedded elsewhere.
   */
  view: handleAuthed('Failed to open your document', async (req, res) => {
    setPrivateHeaders(res);
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    const result = await portalDocumentsService.getView(req.portalClient.clientId, String(req.params.id), abort.signal);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', inlineDisposition(result.fileName));
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (result.size !== null) res.setHeader('Content-Length', String(result.size));
    try {
      // pipeline applies back-pressure and destroys the source stream if the client goes away.
      await pipeline(result.stream, res);
    } catch (err) {
      result.stream.destroy();
      // Headers are already out: the best that can be done is to cut the response. A client that left is not an error.
      if (!abort.signal.aborted) console.error('Portal document view interrupted:', err instanceof Error ? err.message : err);
      res.destroy();
    }
  }),
};
