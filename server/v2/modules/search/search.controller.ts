import { Request, Response } from 'express';
import { searchService } from './search.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';

export const searchController = {
  globalSearch: asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) {
      return successResponse(res, { clients: [], quotes: [], bookings: [] }, 'Search results');
    }
    const scope = getScope(req);
    const results = await searchService.globalSearch(q, scope, 15);
    return successResponse(res, results, 'Search results');
  }),
};
