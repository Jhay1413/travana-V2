import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware';
import { createClientRateLimiter } from './portal-client-rate-limit';
import { portalDocumentsController } from './portal-documents.controller';
import { portalDocumentDownloadValidator, portalDocumentListValidator, portalDocumentViewValidator } from './portal-documents.validator';
import { portalAuth, portalErrorHandler } from './portal.middleware';

/**
 * The customer's "My documents": the files on their own profile (client_files only), listed, downloaded and viewed in the app.
 * Mounted at /api/v2/portal only (new endpoints, no legacy alias).
 */
export const portalDocumentsRouter = Router();

/** Per customer (after sign-in). Listing is generous; each download signs a storage link, so it is tighter. */
const listLimiter = createClientRateLimiter({
  max: 120,
  windowMs: 15 * 60 * 1000,
  message: 'Too many requests. Please wait a few minutes and try again.',
});
const downloadLimiter = createClientRateLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Too many downloads in a short time. Please wait a few minutes and try again.',
});
const viewLimiter = createClientRateLimiter({
  max: 60,
  windowMs: 15 * 60 * 1000,
  message: 'Too many documents opened in a short time. Please wait a few minutes and try again.',
});

portalDocumentsRouter.get('/documents', portalAuth, listLimiter, validate(portalDocumentListValidator), portalDocumentsController.list);
portalDocumentsRouter.get(
  '/documents/:id/download',
  portalAuth,
  downloadLimiter,
  validate(portalDocumentDownloadValidator),
  portalDocumentsController.download,
);
portalDocumentsRouter.get('/documents/:id/view', portalAuth, viewLimiter, validate(portalDocumentViewValidator), portalDocumentsController.view);

portalDocumentsRouter.use(portalErrorHandler);
