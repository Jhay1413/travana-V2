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
}

export interface LookupAccommodation {
  id: string;
  type_id: string | null;
  name: string;
  resorts_id: string | null;
  description: string | null;
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

export interface LookupPackageType {
  id: string;
  name: string;
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
  getDestinations: async (countryId?: string): Promise<LookupDestination[]> => {
    const { data } = await axios.get<LookupDestination[]>("/api/lookup/destinations", { params: countryId ? { countryId } : {} });
    return data;
  },
  getResorts: async (destinationId?: string): Promise<LookupResort[]> => {
    const { data } = await axios.get<LookupResort[]>("/api/lookup/resorts", { params: destinationId ? { destinationId } : {} });
    return data;
  },
  getAccommodations: async (resortId?: string): Promise<LookupAccommodation[]> => {
    const { data } = await axios.get<LookupAccommodation[]>("/api/lookup/accommodations", { params: resortId ? { resortId } : {} });
    return data;
  },
  getBoardBasis: async (): Promise<LookupBoardBasis[]> => {
    const { data } = await axios.get<LookupBoardBasis[]>("/api/lookup/board-basis");
    return data;
  },
  getParks: async (): Promise<LookupPark[]> => {
    const { data } = await axios.get<LookupPark[]>("/api/lookup/parks");
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
};
