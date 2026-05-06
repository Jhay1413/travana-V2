import axios from "@/api/client/axios-client";

export interface LookupCountry {
  id: string;
  country_name: string;
  country_code: string | null;
}

export interface LookupDestination {
  id: string;
  name: string;
  type: string | null;
  country_id: string | null;
}

export interface LookupResort {
  id: string;
  name: string;
  destination_id: string | null;
  destination_name: string | null;
  country_id: string | null;
}

export interface LookupAccommodation {
  id: string;
  type_id: string | null;
  name: string;
  resorts_id: string | null;
  resort_name: string | null;
  description: string | null;
  destination_id: string | null;
  destination_name: string | null;
  country_id: string | null;
}

export interface LookupBoardBasis {
  id: string;
  type: string;
}

export interface LookupPark {
  id: string;
  name: string | null;
  location: string | null;
  city: string | null;
  county: string | null;
  code: string | null;
}

export interface LookupLodge {
  id: string;
  park_id: string | null;
  lodge_name: string | null;
  lodge_code: string | null;
  adults: number | null;
  children: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  pets: number | null;
  sleeps: number | null;
}

export interface LookupCottage {
  id: string;
  cottage_name: string | null;
  location: string | null;
  cottage_code: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sleeps: number | null;
  pets: number | null;
}

export interface LookupAccommodationType {
  id: string;
  type: string | null;
}

export interface LookupPackageType {
  id: string;
  name: string;
}

export interface LookupRoomType {
  id: string;
  name: string | null;
}

export interface LookupCruiseLine {
  id: string;
  name: string | null;
}

export interface LookupCruiseShip {
  id: string;
  name: string | null;
  cruise_line_id: string | null;
}

export interface LookupCruiseItinerary {
  id: string;
  ship_id: string | null;
  itenary: string | null;
  departure_port: string;
  date: string;
}

export interface AccommodationImage {
  id: string;
  accommodation_id: string;
  image_url: string;
  isPrimary: boolean | null;
}

export interface LodgeImage {
  id: string;
  lodge_id: string;
  image_url: string;
  isPrimary: boolean | null;
}

export const lookupApi = {
  getPackageTypes: async (): Promise<LookupPackageType[]> => {
    const { data } = await axios.get<LookupPackageType[]>("/api/lookup/package-types");
    return data;
  },
  getCountries: async (): Promise<LookupCountry[]> => {
    const { data } = await axios.get<LookupCountry[]>("/api/lookup/countries");
    return data;
  },
  getDestinations: async (countryId?: string, search?: string, limit?: number): Promise<LookupDestination[]> => {
    const params: Record<string, any> = {};
    if (countryId) params.countryId = countryId;
    if (search) params.search = search;
    if (limit) params.limit = limit;
    const { data } = await axios.get<LookupDestination[]>("/api/lookup/destinations", { params });
    return data;
  },
  getResorts: async (destinationId?: string, countryId?: string, search?: string, limit?: number): Promise<LookupResort[]> => {
    const params: Record<string, any> = {};
    if (destinationId) params.destinationId = destinationId;
    if (countryId) params.countryId = countryId;
    if (search) params.search = search;
    if (limit) params.limit = limit;
    const { data } = await axios.get<LookupResort[]>("/api/lookup/resorts", { params });
    return data;
  },
  getAccommodations: async (resortId?: string, destinationId?: string, countryId?: string, search?: string, limit?: number): Promise<LookupAccommodation[]> => {
    const params: Record<string, any> = {};
    if (resortId) params.resortId = resortId;
    if (destinationId) params.destinationId = destinationId;
    if (countryId) params.countryId = countryId;
    if (search) params.search = search;
    if (limit) params.limit = limit;
    const { data } = await axios.get<LookupAccommodation[]>("/api/lookup/accommodations", { params });
    return data;
  },
  getBoardBasis: async (): Promise<LookupBoardBasis[]> => {
    const { data } = await axios.get<LookupBoardBasis[]>("/api/lookup/board-basis");
    return data;
  },
  getParks: async (parkId?: string): Promise<LookupPark[]> => {
    const { data } = await axios.get<LookupPark[]>("/api/lookup/parks", { params: parkId ? { parkId } : {} });
    return data;
  },
  getLodges: async (parkId?: string): Promise<LookupLodge[]> => {
    const { data } = await axios.get<LookupLodge[]>("/api/lookup/lodges", { params: parkId ? { parkId } : {} });
    return data;
  },
  getCottages: async (): Promise<LookupCottage[]> => {
    const { data } = await axios.get<LookupCottage[]>("/api/lookup/cottages");
    return data;
  },
  getAccommodationTypes: async (): Promise<LookupAccommodationType[]> => {
    const { data } = await axios.get<LookupAccommodationType[]>("/api/lookup/accommodation-types");
    return data;
  },
  getRoomTypes: async (): Promise<LookupRoomType[]> => {
    const { data } = await axios.get<LookupRoomType[]>("/api/lookup/room-types");
    return data;
  },
  getAccommodationImages: async (accommodationId?: string): Promise<AccommodationImage[]> => {
    if (!accommodationId) return [];
    const { data } = await axios.get<AccommodationImage[]>("/api/lookup/accommodation-images", { params: { accommodationId } });
    return data;
  },
  getLodgeImages: async (lodgeId?: string): Promise<LodgeImage[]> => {
    if (!lodgeId) return [];
    const { data } = await axios.get<LodgeImage[]>("/api/lookup/lodge-images", { params: { lodgeId } });
    return data;
  },
  getCruiseLines: async (): Promise<LookupCruiseLine[]> => {
    const { data } = await axios.get<LookupCruiseLine[]>("/api/lookup/cruise-lines");
    return data;
  },
  getShips: async (cruiseLineId?: string): Promise<LookupCruiseShip[]> => {
    const { data } = await axios.get<LookupCruiseShip[]>("/api/lookup/ships", { params: cruiseLineId ? { cruiseLineId } : {} });
    return data;
  },
  getCruiseItineraries: async (shipId?: string): Promise<LookupCruiseItinerary[]> => {
    if (!shipId) return [];
    const { data } = await axios.get<LookupCruiseItinerary[]>("/api/lookup/cruise-itineraries", { params: { shipId } });
    return data;
  },
};
