import { Request, Response } from "express";
import { clientService } from "./client.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

export const clientController = {
  listClients: asyncHandler(async (req: Request, res: Response) => {
    const clients = await clientService.listClients(getScope(req));
    return successResponse(res, clients, "Clients retrieved successfully");
  }),

  getClientById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const client = await clientService.getClientById(id, getScope(req));
    return successResponse(res, client, "Client retrieved successfully");
  }),

  createClient: asyncHandler(async (req: Request, res: Response) => {
    const client = await clientService.createClient(req.body, getScope(req));
    return successResponse(res, client, "Client created successfully", 201);
  }),

  updateClient: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const client = await clientService.updateClient(id, req.body, getScope(req));
    return successResponse(res, client, "Client updated successfully");
  }),

  deleteClient: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await clientService.deleteClient(id, getScope(req));
    res.status(204).send();
  }),
};
