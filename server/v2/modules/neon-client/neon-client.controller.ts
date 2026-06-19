import { Request, Response } from 'express';
import { neonClientService } from './neon-client.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';
import { getScope } from '../../utils/scope';

export const neonClientController = {
  listNeonClients: asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || undefined;
    const result = await neonClientService.listNeonClientsPaginated(page, limit, search, getScope(req));
    return successResponse(res, result, 'Neon clients retrieved successfully');
  }),

  getNeonClientById: asyncHandler(async (req: Request, res: Response) => {
    const client = await neonClientService.getNeonClientById(req.params.id as string, getScope(req));
    return successResponse(res, client, 'Neon client retrieved successfully');
  }),

  createNeonClient: asyncHandler(async (req: Request, res: Response) => {
    const client = await neonClientService.createNeonClient(req.body, getScope(req));
    return successResponse(res, client, 'Neon client created successfully', 201);
  }),

  updateNeonClient: asyncHandler(async (req: Request, res: Response) => {
    const client = await neonClientService.updateNeonClient(req.params.id as string, req.body, getScope(req));
    return successResponse(res, client, 'Neon client updated successfully');
  }),

  deleteNeonClient: asyncHandler(async (req: Request, res: Response) => {
    await neonClientService.deleteNeonClient(req.params.id as string, getScope(req));
    res.status(204).send();
  }),

  importNeonClients: asyncHandler(async (req: Request, res: Response) => {
    const { clients } = req.body;
    const result = await neonClientService.bulkImportClients(clients, getScope(req));
    return successResponse(res, result, `Import complete: ${result.imported} clients imported`);
  }),

  mergeNeonClient: asyncHandler(async (req: Request, res: Response) => {
    const sourceId = req.params.id as string;
    const { targetId } = req.body as { targetId: string };
    const client = await neonClientService.mergeClients(sourceId, targetId, getScope(req));
    return successResponse(res, client, 'Clients merged successfully');
  }),
};
