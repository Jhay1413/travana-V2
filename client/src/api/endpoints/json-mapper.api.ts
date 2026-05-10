import axiosClient from "../client/axios-client";

export interface JsonMappingInput {
  country?: string;
  destination?: string;
  resort?: string;
  accommodation?: string;
  boardBasis?: string;
  tourOperator?: string;
  outboundDepartAirport?: string;
  outboundArriveAirport?: string;
  inboundDepartAirport?: string;
  inboundArriveAirport?: string;
  roomType?: string;
  lodgeCode?: string | null;
  lodgeName?: string;
  parkName?: string;
  parkCode?: string | null;
}

export interface JsonMappingResult {
  countryId: string;
  destinationId: string;
  resortId: string;
  accommodationId: string;
  boardBasisId: string;
  tourOperatorId: string;
  outboundDepartAirportId: string;
  outboundArriveAirportId: string;
  inboundDepartAirportId: string;
  inboundArriveAirportId: string;
  roomTypeId: string;
  lodgeId: string;
  parkId: string;
  warnings: string[];
}

export const jsonMapperApi = {
  /**
   * Map JSON text values to database IDs
   */
  mapToIds: async (input: JsonMappingInput): Promise<JsonMappingResult> => {
    const { data } = await axiosClient.post<JsonMappingResult>(
      "/api/v2/json-mapper/map-to-ids",
      input
    );
    return data as unknown as JsonMappingResult;
  },
};
