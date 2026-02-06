import { Request, Response } from "express";
import { flightService } from "../services/flight.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const flightController = {
  listByQuoteId: asyncHandler(async (req: Request, res: Response) => {
    const quoteId = req.params.quoteId as string;
    const flights = await flightService.listByQuoteId(quoteId);
    return successResponse(res, flights, "Flights retrieved successfully");
  }),

  createFlight: asyncHandler(async (req: Request, res: Response) => {
    const flight = await flightService.createFlight(req.body);
    return successResponse(res, flight, "Flight created successfully", 201);
  }),

  updateFlight: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const flight = await flightService.updateFlight(id, req.body);
    return successResponse(res, flight, "Flight updated successfully");
  }),
};
