import { Request, Response } from 'express';
import { neonClientService } from './neon-client.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';
import { getScope } from '../../utils/scope';
import { toPublicClient } from './neon-client.serializer';

export const neonClientController = {
  listNeonClients: asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || undefined;
    const result = await neonClientService.listNeonClientsPaginated(page, limit, search, getScope(req));
    return successResponse(res, { ...result, clients: result.clients.map(toPublicClient) }, 'Neon clients retrieved successfully');
  }),

  getNeonClientById: asyncHandler(async (req: Request, res: Response) => {
    const client = await neonClientService.getNeonClientById(req.params.id as string, getScope(req));
    return successResponse(res, toPublicClient(client), 'Neon client retrieved successfully');
  }),

  createNeonClient: asyncHandler(async (req: Request, res: Response) => {
    const client = await neonClientService.createNeonClient(req.body, getScope(req));
    return successResponse(res, toPublicClient(client), 'Neon client created successfully', 201);
  }),

  updateNeonClient: asyncHandler(async (req: Request, res: Response) => {
    const client = await neonClientService.updateNeonClient(req.params.id as string, req.body, getScope(req));
    return successResponse(res, toPublicClient(client), 'Neon client updated successfully');
  }),

  deleteNeonClient: asyncHandler(async (req: Request, res: Response) => {
    await neonClientService.deleteNeonClient(req.params.id as string, getScope(req));
    res.status(204).send();
  }),

  getPortalPin: asyncHandler(async (req: Request, res: Response) => {
    const status = await neonClientService.getPortalPinStatus(req.params.id as string, getScope(req));
    return successResponse(res, status, 'Portal PIN status retrieved');
  }),

  setPortalPin: asyncHandler(async (req: Request, res: Response) => {
    const { pin } = req.body as { pin: string };
    const status = await neonClientService.setPortalPin(req.params.id as string, pin, getScope(req));
    return successResponse(res, status, 'Portal PIN set');
  }),

  removePortalPin: asyncHandler(async (req: Request, res: Response) => {
    await neonClientService.removePortalPin(req.params.id as string, getScope(req));
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
    return successResponse(res, toPublicClient(client), 'Clients merged successfully');
  }),

  listDuplicatePhoneGroups: asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || undefined;
    const result = await neonClientService.listDuplicatePhoneGroups(page, limit, search, getScope(req));
    return successResponse(res, result, 'Duplicate phone numbers retrieved successfully');
  }),

  getDuplicatePhoneGroup: asyncHandler(async (req: Request, res: Response) => {
    const result = await neonClientService.getDuplicatePhoneGroup(req.params.phoneKey as string, getScope(req));
    return successResponse(res, { ...result, clients: result.clients.map(toPublicClient) }, 'Duplicate clients retrieved successfully');
  }),

  mergeDuplicateGroup: asyncHandler(async (req: Request, res: Response) => {
    const targetId = req.params.id as string;
    const { sourceIds } = req.body as { sourceIds: string[] };
    const result = await neonClientService.mergeDuplicatesInto(targetId, sourceIds, getScope(req));
    return successResponse(res, { ...result, target: toPublicClient(result.target) }, `${result.mergedIds.length} duplicate client(s) merged successfully`);
  }),
};
