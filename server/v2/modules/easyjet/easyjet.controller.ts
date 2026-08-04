import { Request, Response } from 'express';
import { easyjetService } from './easyjet.service';
import { asyncHandler } from '../../utils/async-handler';

export const easyjetController = {
  scrapeQuote: asyncHandler(async (req: Request, res: Response) => {
    const result = await easyjetService.scrapeQuoteFromLink(req.body);
    return res.status(200).json({ success: true, data: result });
  }),
};
