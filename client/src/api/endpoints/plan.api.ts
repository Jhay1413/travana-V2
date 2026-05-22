import axiosClient from "../client/axios-client";

export type PlanCode = "starter" | "growth" | "enterprise";

export interface Plan {
  id:          string;
  code:        PlanCode;
  name:        string;
  branchLimit: number | null;
  seatLimit:   number | null;
  priceCents:  number;
  features:    Record<string, unknown>;
  createdAt:   string;
}

export const planApi = {
  list: async (): Promise<Plan[]> => {
    const { data } = await axiosClient.get<{ data: Plan[] }>("/api/v2/plans");
    return data?.data ?? (data as unknown as Plan[]);
  },
};
