import { Request, Response } from 'express';
import { cruiseSettingsService } from './cruise.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const cruiseSettingsController = {
  // ─── Lines ──────────────────────────────────────────────────────────────
  findAllLines: asyncHandler(async (req: Request, res: Response) => {
    const result = await cruiseSettingsService.findAllLines(req.query);
    return successResponse(res, result, 'Cruise lines retrieved');
  }),
  findLineById: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.findLineById((req.params.id as string));
    return successResponse(res, row, 'Cruise line retrieved');
  }),
  createLine: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.createLine(req.body);
    return successResponse(res, row, 'Cruise line created', 201);
  }),
  updateLine: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.updateLine((req.params.id as string), req.body);
    return successResponse(res, row, 'Cruise line updated');
  }),
  removeLine: asyncHandler(async (req: Request, res: Response) => {
    await cruiseSettingsService.removeLine((req.params.id as string));
    res.status(204).send();
  }),

  // ─── Ships ──────────────────────────────────────────────────────────────
  findAllShips: asyncHandler(async (req: Request, res: Response) => {
    const result = await cruiseSettingsService.findAllShips(req.query);
    return successResponse(res, result, 'Cruise ships retrieved');
  }),
  findShipById: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.findShipById((req.params.id as string));
    return successResponse(res, row, 'Cruise ship retrieved');
  }),
  createShip: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.createShip(req.body);
    return successResponse(res, row, 'Cruise ship created', 201);
  }),
  updateShip: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.updateShip((req.params.id as string), req.body);
    return successResponse(res, row, 'Cruise ship updated');
  }),
  removeShip: asyncHandler(async (req: Request, res: Response) => {
    await cruiseSettingsService.removeShip((req.params.id as string));
    res.status(204).send();
  }),

  // ─── Itineraries ────────────────────────────────────────────────────────
  findAllItineraries: asyncHandler(async (req: Request, res: Response) => {
    const result = await cruiseSettingsService.findAllItineraries(req.query);
    return successResponse(res, result, 'Cruise itineraries retrieved');
  }),
  findItineraryById: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.findItineraryById((req.params.id as string));
    return successResponse(res, row, 'Cruise itinerary retrieved');
  }),
  createItinerary: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.createItinerary(req.body);
    return successResponse(res, row, 'Cruise itinerary created', 201);
  }),
  updateItinerary: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseSettingsService.updateItinerary((req.params.id as string), req.body);
    return successResponse(res, row, 'Cruise itinerary updated');
  }),
  removeItinerary: asyncHandler(async (req: Request, res: Response) => {
    await cruiseSettingsService.removeItinerary((req.params.id as string));
    res.status(204).send();
  }),
};
