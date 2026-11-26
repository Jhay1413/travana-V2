import axiosClient from "@/api/client/axios-client";
import { CUSTOMER_MESSAGING_STAFF_ENDPOINTS } from "@/api/endpoints";
import type { MessageLogPage, SendAvailability, StaffMessagePurpose, StaffSendInput, StaffSendResult } from "../types";

export const customerMessagingStaffApi = {
  getAvailability: async (clientId: string, purpose: StaffMessagePurpose): Promise<SendAvailability> => {
    const { data } = await axiosClient.get<SendAvailability>(CUSTOMER_MESSAGING_STAFF_ENDPOINTS.availability, { params: { clientId, purpose } });
    return data;
  },
  send: async (input: StaffSendInput): Promise<StaffSendResult> => {
    const { data } = await axiosClient.post<StaffSendResult>(CUSTOMER_MESSAGING_STAFF_ENDPOINTS.send, input);
    return data;
  },
  getLog: async (clientId: string, opts: { limit?: number; cursor?: string } = {}): Promise<MessageLogPage> => {
    const { data } = await axiosClient.get<MessageLogPage>(CUSTOMER_MESSAGING_STAFF_ENDPOINTS.log, { params: { clientId, ...opts } });
    return data;
  },
};
