import { flightRepository } from "../repositories/flight.repository";
import { AppError } from "../utils/error-handler";
import type { Flight, InsertFlight } from "../types/flight";

export const flightService = {
  async listByQuoteId(quoteId: string): Promise<Flight[]> {
    return await flightRepository.findByQuoteId(quoteId);
  },

  async createFlight(data: InsertFlight): Promise<Flight> {
    const flight = await flightRepository.create(data);
    return flight;
  },

  async updateFlight(id: string, data: Partial<InsertFlight>): Promise<Flight> {
    const flight = await flightRepository.update(id, data);
    if (!flight) {
      throw new AppError("Flight not found", 404);
    }
    return flight;
  },
};
