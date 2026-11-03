import { Request, Response } from 'express';
import { destinationGuruService } from './destination-guru.service';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';
import { getScope } from '../../utils/scope';

export const destinationGuruController = {
  getAll: asyncHandler(async (_req: Request, res: Response) => {
    const destinations = await destinationGuruService.getAll();
    res.json({ success: true, data: destinations });
  }),

  getByDestination: asyncHandler(async (req: Request, res: Response) => {
    const destination = await destinationGuruService.getByDestination((req.params.destination as string));
    if (!destination) return res.status(404).json({ success: false, message: 'Destination not found' });
    res.json({ success: true, data: destination });
  }),

  generate: asyncHandler(async (req: Request, res: Response) => {
    const { destination } = req.body as { destination: string };
    const userId = getUserId(req);
    // validate() only checks the parsed shape — it doesn't rewrite req.body
    // with the schema's transforms, so trim here too (see validation.middleware.ts).
    const result = await destinationGuruService.generate(destination.trim(), userId || undefined, getScope(req).orgId);
    res.json({ success: true, data: result });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const destination = await destinationGuruService.getById((req.params.id as string));
    if (!destination) return res.status(404).json({ success: false, message: 'Destination not found' });
    res.json({ success: true, data: destination });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await destinationGuruService.remove((req.params.id as string));
    res.json({ success: true, message: 'Destination removed' });
  }),

  updateCoordinates: asyncHandler(async (req: Request, res: Response) => {
    const { latitude, longitude } = req.body as { latitude: number; longitude: number };
    const result = await destinationGuruService.updateCoordinates(req.params.id as string, latitude, longitude);
    res.json({ success: true, data: result });
  }),
};
