import { airportRepository } from './airport.repository';
import { AppError } from '../../utils/error-handler';
import type { InsertAirport } from '@shared/schema';
import { MOST_USED_DEPARTURE_LIMIT, PINNED_DEPARTURE_AIRPORT_CODES } from '@shared/departure-airports';

export const airportService = {
  async listAirports(opts?: { countryIds?: string[] }) {
    return airportRepository.findAll(opts);
  },

  // Ids of the organisation's most-used departure airports, most used first.
  // Pinned airports are excluded (they always show first anyway).
  async mostUsedDepartureAirportIds(orgId: string): Promise<string[]> {
    if (!orgId) throw new AppError('Organisation scope required', 403);
    const [fromEnquiries, fromQuotes] = await Promise.all([
      airportRepository.countEnquiryDepartures(orgId),
      airportRepository.countQuoteDepartures(orgId),
    ]);
    const pinned = new Set(PINNED_DEPARTURE_AIRPORT_CODES);
    const totals = new Map<string, number>();
    for (const r of [...fromEnquiries, ...fromQuotes]) {
      if (r.code && pinned.has(r.code.trim().toUpperCase())) continue;
      totals.set(r.airportId, (totals.get(r.airportId) ?? 0) + r.uses);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MOST_USED_DEPARTURE_LIMIT)
      .map(([id]) => id);
  },

  async createAirport(data: InsertAirport) {
    return airportRepository.create(data);
  },

  async deleteAirport(id: string) {
    const existing = await airportRepository.findById(id);
    if (!existing) throw new AppError('Airport not found', 404);
    await airportRepository.remove(id);
  },
};
