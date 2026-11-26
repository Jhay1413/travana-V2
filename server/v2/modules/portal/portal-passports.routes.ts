import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { PORTAL_PASSPORT_PHOTO_MAX_BYTES } from '@shared/portal-passengers';
import { AppError } from '../../utils/error-handler';
import { noResponseLog } from '../../middlewares/no-response-log';
import { validate } from '../../middlewares/validation.middleware';
import { portalAuth, portalErrorHandler } from './portal.middleware';
import { PASSPORT_NOT_AN_IMAGE_MESSAGE, PASSPORT_TOO_LARGE_MESSAGE } from './portal-passport-read.service';
import { portalPassportsController } from './portal-passports.controller';
import { portalCreatePassengerValidator, portalSavePassportValidator } from './portal-passports.validator';

/**
 * The customer's passengers and passports. The customer is always the signed-in one (never named by the request).
 * The photo is held in memory by multer for the one request; it is never written to disk or storage.
 */
export const portalPassportsRouter = Router();
// Passport details and names must never be printed by the global request logger.
portalPassportsRouter.use(noResponseLog);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PORTAL_PASSPORT_PHOTO_MAX_BYTES, files: 1, fields: 0 } });

/** multer's own errors would reach the portal as a bare 500; turn them into plain answers. */
export function acceptPassportPhoto(req: Request, res: Response, next: NextFunction): void {
  upload.single('photo')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return next(new AppError(PASSPORT_TOO_LARGE_MESSAGE, 413));
    return next(new AppError(PASSPORT_NOT_AN_IMAGE_MESSAGE, 400));
  });
}

portalPassportsRouter.get('/passengers', portalAuth, portalPassportsController.list);
portalPassportsRouter.post('/passengers', portalAuth, validate(portalCreatePassengerValidator), portalPassportsController.create);
portalPassportsRouter.put('/passengers/:id/passport', portalAuth, validate(portalSavePassportValidator), portalPassportsController.save);
portalPassportsRouter.post('/passports/read', portalAuth, acceptPassportPhoto, portalPassportsController.read);

portalPassportsRouter.use(portalErrorHandler);
