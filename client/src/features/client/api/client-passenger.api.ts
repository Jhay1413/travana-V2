import axiosClient from "@/api/client/axios-client";
import { NEON_CLIENT_ENDPOINTS } from "@/api/endpoints";

export interface ClientPassenger {
  /** null only for the lead when no lead row is saved yet. */
  id: string | null;
  isLead: boolean;
  title: string | null;
  firstName: string;
  surname: string;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  passportNumber: string | null;
  /** YYYY-MM-DD */
  passportExpiry: string | null;
  passportWarning: boolean;
}

export interface ClientPassengersResponse {
  passengers: ClientPassenger[];
  /** YYYY-MM-DD */
  nextDeparture: string | null;
}

export interface LeadPassportInput {
  passportNumber: string | null;
  passportExpiry: string | null;
}

export interface PassengerInput {
  title?: string | null;
  firstName: string;
  surname: string;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
}

export const clientPassengerApi = {
  list: async (clientId: string): Promise<ClientPassengersResponse> => {
    const { data } = await axiosClient.get<ClientPassengersResponse>(NEON_CLIENT_ENDPOINTS.passengers(clientId));
    return data;
  },

  saveLead: async (clientId: string, input: LeadPassportInput): Promise<ClientPassenger> => {
    const { data } = await axiosClient.put<ClientPassenger>(NEON_CLIENT_ENDPOINTS.passengerLead(clientId), input);
    return data;
  },

  create: async (clientId: string, input: PassengerInput): Promise<ClientPassenger> => {
    const { data } = await axiosClient.post<ClientPassenger>(NEON_CLIENT_ENDPOINTS.passengers(clientId), input);
    return data;
  },

  update: async (clientId: string, passengerId: string, input: Partial<PassengerInput>): Promise<ClientPassenger> => {
    const { data } = await axiosClient.patch<ClientPassenger>(NEON_CLIENT_ENDPOINTS.passenger(clientId, passengerId), input);
    return data;
  },

  remove: async (clientId: string, passengerId: string): Promise<void> => {
    await axiosClient.delete(NEON_CLIENT_ENDPOINTS.passenger(clientId, passengerId));
  },
};
