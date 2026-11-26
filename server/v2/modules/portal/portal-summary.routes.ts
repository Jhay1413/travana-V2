import { Router } from 'express';
import { noResponseLog } from '../../middlewares/no-response-log';
import { portalAuth, portalErrorHandler } from './portal.middleware';
import { portalSummaryController } from './portal-summary.controller';

/** The customer's Home summary. The customer is always the signed-in one; the request names nothing (no params, no body), so there is nothing to validate. */
export const portalSummaryRouter = Router();
portalSummaryRouter.use(noResponseLog);

portalSummaryRouter.get('/summary', portalAuth, portalSummaryController.summary);

portalSummaryRouter.use(portalErrorHandler);
