import { Request, Response } from 'express';
import { searchService } from './search.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';

export const searchController = {
  globalSearch: asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) {
      return successResponse(res, { clients: [], bookings: [], nextOffset: null }, 'Search results');
    }
    const offsetRaw = Number.parseInt((req.query.offset as string) ?? '0', 10);
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
    const scope = getScope(req);
    const results = await searchService.globalSearch(q, scope, 15, offset);
    return successResponse(res, results, 'Search results');
  }),
};
