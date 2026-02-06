import { airportRepository } from "../repositories/airport.repository";
import type { Airport, InsertAirport } from "../types/airport";

export const airportService = {
  async listAirports(): Promise<Airport[]> {
    return await airportRepository.findAll();
  },

  async createAirport(data: InsertAirport): Promise<Airport> {
    const airport = await airportRepository.create(data);
    return airport;
  },

  async deleteAirport(id: string): Promise<void> {
    await airportRepository.remove(id);
  },
};
