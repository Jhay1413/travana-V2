import { Request, Response } from "express";
import { neonClientService } from "../services/neonClient.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const neonClientController = {
  listNeonClients: asyncHandler(async (_req: Request, res: Response) => {
    const clients = await neonClientService.listNeonClients();
    return successResponse(res, clients, "Neon clients retrieved successfully");
  }),

  getNeonClientById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const client = await neonClientService.getNeonClientById(id);
    return successResponse(res, client, "Neon client retrieved successfully");
  }),

  createNeonClient: asyncHandler(async (req: Request, res: Response) => {
    const client = await neonClientService.createNeonClient(req.body);
    return successResponse(res, client, "Neon client created successfully", 201);
  }),

  updateNeonClient: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const client = await neonClientService.updateNeonClient(id, req.body);
    return successResponse(res, client, "Neon client updated successfully");
  }),

  deleteNeonClient: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await neonClientService.deleteNeonClient(id);
    res.status(204).send();
  }),
};
