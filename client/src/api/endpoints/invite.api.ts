import axiosClient from "../client/axios-client";

export type InviteOrgRole = "branch_manager" | "agent" | "homeworker" | "referral_agent";

export interface SendInvitePayload {
  email:    string;
  branchId: string;
  orgRole:  InviteOrgRole;
}

export interface AcceptInvitePayload {
  token:       string;
  firstName:   string;
  lastName:    string;
  phoneNumber: string;
  password:    string;
}

export interface PendingInvite {
  userId:            string;
  email:             string;
  orgRole:           string | null;
  invitedAt:         string | null;
  inviteTokenExpiry: string | null;
  invitedBy:         string | null;
  branchId:          string | null;
  branchName:        string | null;
}

export interface InviteInfo {
  email:     string;
  orgRole:   string | null;
  orgName:   string | null;
  expiresAt: string;
}

export const inviteApi = {
  send: async (payload: SendInvitePayload) => {
    const { data } = await axiosClient.post("/api/v2/invites", payload);
    return data;
  },
  resend: async (userId: string) => {
    const { data } = await axiosClient.post(`/api/v2/invites/${userId}/resend`);
    return data;
  },
  list: async (): Promise<PendingInvite[]> => {
    const { data } = await axiosClient.get<PendingInvite[]>("/api/v2/invites");
    return data;
  },
  revoke: async (userId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/invites/${userId}`);
  },
  // Public — invitee uses these
  getByToken: async (token: string): Promise<InviteInfo> => {
    const { data } = await axiosClient.get<InviteInfo>("/api/v2/invites/accept", { params: { token } });
    return data;
  },
  accept: async (payload: AcceptInvitePayload) => {
    const { data } = await axiosClient.post("/api/v2/invites/accept", payload);
    return data;
  },
};
