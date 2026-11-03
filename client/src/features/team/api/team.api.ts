import axiosClient from "@/api/client/axios-client";
import type {
  MemberProfilePatch,
  MemberProfileResult,
  MemberWorkload,
  RemoveMemberInput,
  RemoveMemberResult,
} from "../types";

const members = (userId: string) => `/api/v2/organizations/me/members/${encodeURIComponent(userId)}`;

export const teamApi = {
  getWorkload: async (userId: string): Promise<MemberWorkload> => {
    const { data } = await axiosClient.get<MemberWorkload>(`${members(userId)}/workload`);
    return data;
  },

  removeMember: async (userId: string, input: RemoveMemberInput): Promise<RemoveMemberResult> => {
    const { data } = await axiosClient.post<RemoveMemberResult>(`${members(userId)}/remove`, input);
    return data;
  },

  updateMemberProfile: async (userId: string, patch: MemberProfilePatch): Promise<MemberProfileResult> => {
    const { data } = await axiosClient.patch<MemberProfileResult>(`${members(userId)}/profile`, patch);
    return data;
  },
};
