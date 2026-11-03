import { Request, Response } from 'express';
import { jsonMapperService } from './json-mapper.service';
import { asyncHandler } from '../../utils/async-handler';
import { getScope } from '../../utils/scope';
import { canWriteOperators } from '../tour-operator/tour-operator-access';

export const jsonMapperController = {
  mapToIds: asyncHandler(async (req: Request, res: Response) => {
    // The org scope matters here: a resolved tour operator is linked to the
    // caller's org so the quote form's dropdown can render it.
    const scope = getScope(req);
    const result = await jsonMapperService.mapJsonToIds(req.body, scope.orgId, scope.userId, canWriteOperators(scope));
    return res.status(200).json({ success: true, data: result });
  }),
};
