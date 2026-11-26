import type { Response } from 'express';
import type { PortalDocumentDownloadLink } from '@shared/portal-documents';
import { handleAuthed } from './portal-handlers';
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
};
