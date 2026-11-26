import type { RequestHandler } from 'express';
import { PIN_RESET_REPLY_MESSAGE, portalPinResetService } from './portal-pin-reset.service';
import type { PortalPinResetBody } from './portal-pin-reset.validator';

export const portalPinResetController: { requestReset: RequestHandler } = {
  /** POST /pin-reset: the same 200 for every valid request. */
  requestReset: async (req, res, next) => {
    try {
      const { email, org } = req.body as PortalPinResetBody;
      await portalPinResetService.requestReset({ email, org });
      res.json({ success: true, message: PIN_RESET_REPLY_MESSAGE });
    } catch (err) {
      next(err);
    }
  },
};
