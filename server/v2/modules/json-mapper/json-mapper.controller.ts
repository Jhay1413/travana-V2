import { Request, Response } from 'express';
import { jsonMapperService } from './json-mapper.service';
import { asyncHandler } from '../../utils/async-handler';
import { getScope } from '../../utils/scope';

export const jsonMapperController = {
  mapToIds: asyncHandler(async (req: Request, res: Response) => {
    // The org scope matters here: tour operators are org-owned, and an id from
    // outside the caller's org is one the quote form's dropdown cannot render.
    const { orgId } = getScope(req);
    const result = await jsonMapperService.mapJsonToIds(req.body, orgId);
    return res.status(200).json({ success: true, data: result });
  }),
};
