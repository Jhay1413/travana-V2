import { Request, Response } from 'express';
import { clientPassengerService } from './client-passenger.service';
import type { CreatePassengerInput, UpdatePassengerInput } from './client-passenger.types';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';
import { getScope } from '../../utils/scope';

export const clientPassengerController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await clientPassengerService.list(req.params.clientId as string, getScope(req));
    return successResponse(res, result, 'Passengers retrieved successfully');
  }),

  setLead: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { passportNumber?: string | null; passportExpiry?: string | null };
    const lead = await clientPassengerService.setLeadPassport(req.params.clientId as string, body, getScope(req));
    return successResponse(res, lead, 'Lead passport saved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const passenger = await clientPassengerService.create(
      req.params.clientId as string,
      req.body as CreatePassengerInput,
      getScope(req),
    );
    return successResponse(res, passenger, 'Passenger created successfully', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const passenger = await clientPassengerService.update(
      req.params.clientId as string,
      req.params.passengerId as string,
      req.body as UpdatePassengerInput,
      getScope(req),
    );
    return successResponse(res, passenger, 'Passenger updated successfully');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await clientPassengerService.remove(req.params.clientId as string, req.params.passengerId as string, getScope(req));
    res.status(204).send();
  }),
};
