import { Request, Response } from 'express';
import { airportService } from './airport.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';

export const airportController = {
  listAirports: asyncHandler(async (req: Request, res: Response) => {
    const raw = req.query.countryIds;
    const countryIds = typeof raw === 'string' && raw.length
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const airports = await airportService.listAirports({ countryIds });
    return successResponse(res, airports, 'Airports retrieved successfully');
  }),

  createAirport: asyncHandler(async (req: Request, res: Response) => {
    const airport = await airportService.createAirport(req.body);
    return successResponse(res, airport, 'Airport created successfully', 201);
  }),

  deleteAirport: asyncHandler(async (req: Request, res: Response) => {
    await airportService.deleteAirport(req.params.id);
    res.status(204).send();
  }),
};
