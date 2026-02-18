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
  warnings: string[];
}

export const jsonMapperApi = {
  /**
   * Map JSON text values to database IDs
   */
  mapToIds: async (input: JsonMappingInput): Promise<JsonMappingResult> => {
    const { data } = await axiosClient.post<JsonMappingResult>(
      "/api/json-mapper/map-to-ids",
      input
    );
    return data as unknown as JsonMappingResult;
  },
};
