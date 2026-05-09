import { cruiseSettingsRepository } from './cruise.repository';
import { AppError } from '../../../utils/error-handler';

export const cruiseSettingsService = {
  // ─── Lines ──────────────────────────────────────────────────────────────
  async findAllLines(query: Record<string, any>) {
    return cruiseSettingsRepository.findAllLines(query);
  },
  async findLineById(id: string) {
    const row = await cruiseSettingsRepository.findLineById(id);
    if (!row) throw new AppError('Cruise line not found', 404);
    return row;
  },
  async createLine(data: any) {
    return cruiseSettingsRepository.createLine(data);
  },
  async updateLine(id: string, data: any) {
    const row = await cruiseSettingsRepository.updateLine(id, data);
    if (!row) throw new AppError('Cruise line not found', 404);
    return row;
  },
  async removeLine(id: string) {
    await cruiseSettingsRepository.removeLine(id);
  },

  // ─── Ships ──────────────────────────────────────────────────────────────
  async findAllShips(query: Record<string, any>) {
    return cruiseSettingsRepository.findAllShips(query);
  },
  async findShipById(id: string) {
    const row = await cruiseSettingsRepository.findShipById(id);
    if (!row) throw new AppError('Cruise ship not found', 404);
    return row;
  },
  async createShip(data: any) {
    return cruiseSettingsRepository.createShip(data);
  },
  async updateShip(id: string, data: any) {
    const row = await cruiseSettingsRepository.updateShip(id, data);
    if (!row) throw new AppError('Cruise ship not found', 404);
    return row;
  },
  async removeShip(id: string) {
    await cruiseSettingsRepository.removeShip(id);
  },

  // ─── Itineraries ────────────────────────────────────────────────────────
  async findAllItineraries(query: Record<string, any>) {
    return cruiseSettingsRepository.findAllItineraries(query);
  },
  async findItineraryById(id: string) {
    const row = await cruiseSettingsRepository.findItineraryById(id);
    if (!row) throw new AppError('Cruise itinerary not found', 404);
    return row;
  },
  async createItinerary(data: any) {
    return cruiseSettingsRepository.createItinerary(data);
  },
  async updateItinerary(id: string, data: any) {
    const row = await cruiseSettingsRepository.updateItinerary(id, data);
    if (!row) throw new AppError('Cruise itinerary not found', 404);
    return row;
  },
  async removeItinerary(id: string) {
    await cruiseSettingsRepository.removeItinerary(id);
  },
};
