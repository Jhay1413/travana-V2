import axiosClient from "@/api/client/axios-client";
import { ONBOARDING_ENDPOINTS } from "@/api/endpoints";
import type {
  CreateShopsResult,
  OnboardingState,
  SaveBusinessInput,
  ShopInput,
  SignupInput,
} from "../types";

/** The response interceptor unwraps the `{ data }` envelope, so these return the payload directly. */
export const onboardingApi = {
  signup: async (input: SignupInput): Promise<unknown> => {
    const res = await axiosClient.post<unknown>(ONBOARDING_ENDPOINTS.signup, input);
    return res.data;
  },

  getState: async (): Promise<OnboardingState> => {
    const { data } = await axiosClient.get<OnboardingState>(ONBOARDING_ENDPOINTS.state);
    return data;
  },

  saveBusiness: async (input: SaveBusinessInput): Promise<OnboardingState> => {
    const { data } = await axiosClient.put<OnboardingState>(ONBOARDING_ENDPOINTS.business, input);
    return data;
  },

  createShops: async (shops: ShopInput[]): Promise<CreateShopsResult> => {
    const { data } = await axiosClient.post<CreateShopsResult>(ONBOARDING_ENDPOINTS.shops, { shops });
    return data;
  },

  saveHomeworkerCommission: async (percent: number | null): Promise<{ homeworkerCommission: number | null }> => {
    const { data } = await axiosClient.put<{ homeworkerCommission: number | null }>(
      ONBOARDING_ENDPOINTS.homeworkerCommission,
      { percent },
    );
    return data;
  },

  complete: async (): Promise<{ status: "complete" }> => {
    const { data } = await axiosClient.post<{ status: "complete" }>(ONBOARDING_ENDPOINTS.complete);
    return data;
  },
};
