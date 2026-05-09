import { lookupRepository } from './lookup.repository';

export const lookupService = {
  async getCountries() {
    return lookupRepository.getCountries();
  },

  async getDestinations(opts: { countryId?: string; search?: string; limit?: number }) {
    return lookupRepository.getDestinations(opts);
  },

  async getResorts(opts: { destinationId?: string; countryId?: string; search?: string; limit?: number }) {
    return lookupRepository.getResorts(opts);
  },

  async getAccommodations(opts: { resortId?: string; destinationId?: string; countryId?: string; search?: string; limit?: number }) {
    return lookupRepository.getAccommodations(opts);
  },

  async getBoardBasis() {
    return lookupRepository.getBoardBasis();
  },

  async getParks(parkId?: string) {
    return lookupRepository.getParks(parkId);
  },

  async getLodges(parkId?: string) {
    return lookupRepository.getLodges(parkId);
  },

  async getPackageTypes() {
    return lookupRepository.getPackageTypes();
  },

  async getAccommodationTypes() {
    return lookupRepository.getAccommodationTypes();
  },

  async getCottages() {
    return lookupRepository.getCottages();
  },

  async getRoomTypes() {
    return lookupRepository.getRoomTypes();
  },

  async getAccommodationImages(accommodationId: string) {
    return lookupRepository.getAccommodationImages(accommodationId);
  },

  async getLodgeImages(lodgeId: string) {
    return lookupRepository.getLodgeImages(lodgeId);
  },

  async getCruiseLines() {
    return lookupRepository.getCruiseLines();
  },

  async getShips(cruiseLineId?: string) {
    return lookupRepository.getShips(cruiseLineId);
  },

  async getCruiseItineraries(shipId: string) {
    return lookupRepository.getCruiseItineraries(shipId);
  },
};
