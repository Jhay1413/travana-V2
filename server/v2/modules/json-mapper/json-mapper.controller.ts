import { Request, Response } from 'express';
import { jsonMapperService } from './json-mapper.service';
import { asyncHandler } from '../../utils/async-handler';

export const jsonMapperController = {
  mapToIds: asyncHandler(async (req: Request, res: Response) => {
    const result = await jsonMapperService.mapJsonToIds(req.body);
    return res.status(200).json({ success: true, data: result });
  }),
};
