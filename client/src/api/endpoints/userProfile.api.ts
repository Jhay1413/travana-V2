import axiosClient from "../client/axios-client";
import type { UserProfile } from "@shared/schema";

export interface UserProfilePayload {
  bio?: string;
  extendedBio?: string;
  location?: string;
  specialisation?: string;
  certifications?: string;
  coverImage?: string;
}

export const userProfileApi = {
  getMyProfile: async (): Promise<UserProfile | null> => {
    const { data } = await axiosClient.get<UserProfile | null>("/api/user-profiles/me");
    return data;
  },

  getByUserId: async (userId: string): Promise<UserProfile | null> => {
    const { data } = await axiosClient.get<UserProfile | null>(`/api/user-profiles/${userId}`);
    return data;
  },

  saveMyProfile: async (payload: UserProfilePayload): Promise<UserProfile> => {
    const { data } = await axiosClient.put<UserProfile>("/api/user-profiles/me", payload);
    return data;
  },
};
