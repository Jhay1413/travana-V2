import { Request, Response } from "express";
import { airportService } from "../services/airport.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const airportController = {
  listAirports: asyncHandler(async (_req: Request, res: Response) => {
    const airports = await airportService.listAirports();
    return successResponse(res, airports, "Airports retrieved successfully");
  }),

  createAirport: asyncHandler(async (req: Request, res: Response) => {
    const airport = await airportService.createAirport(req.body);
    return successResponse(res, airport, "Airport created successfully", 201);
  }),

  deleteAirport: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await airportService.deleteAirport(id);
    res.status(204).send();
  }),
};
