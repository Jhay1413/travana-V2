import axiosClient from "@/api/client/axios-client";
import { BRANCH_ENDPOINTS } from "@/api/endpoints";

export interface BranchOpeningHour {
  day:       string;
  open:      boolean;
  openTime:  string;
  closeTime: string;
}

export type BranchOpeningPattern = "mon-fri" | "mon-sat" | "seven-days";

export type BranchType = "shop" | "homeworker";

export interface Branch {
  id:               string;
  organizationId:   string;
  name:             string;
  code:             string | null;
  address:          string | null;
  phone:            string | null;
  email:            string | null;
  openingPattern:   BranchOpeningPattern | null;
  bankHolidaysOpen: boolean;
  openingHours:     BranchOpeningHour[];
  isDefault:        boolean;
  isActive:         boolean;
  createdAt:        string;
  /** Present on servers that return it; absent means shop. */
  branchType?:      BranchType;
}

export type BranchInput = Partial<{
  name:             string;
  code:             string | null;
  address:          string | null;
  phone:            string | null;
  email:            string | null;
  openingPattern:   BranchOpeningPattern | null;
  bankHolidaysOpen: boolean;
  openingHours:     BranchOpeningHour[];
  isDefault:        boolean;
  isActive:         boolean;
}>;

export const branchApi = {
  /** Shop branches by default; "homeworker" is admin-only on the server. */
  list: async (type: BranchType = "shop"): Promise<Branch[]> => {
    const { data } = await axiosClient.get<Branch[]>(BRANCH_ENDPOINTS.base, { params: { type } });
    return data;
  },
  getById: async (id: string): Promise<Branch> => {
    const { data } = await axiosClient.get<Branch>(BRANCH_ENDPOINTS.byId(id));
    return data;
  },
  create: async (input: BranchInput): Promise<Branch> => {
    const { data } = await axiosClient.post<Branch>(BRANCH_ENDPOINTS.base, input);
    return data;
  },
  update: async (id: string, input: BranchInput): Promise<Branch> => {
    const { data } = await axiosClient.patch<Branch>(BRANCH_ENDPOINTS.byId(id), input);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(BRANCH_ENDPOINTS.byId(id));
  },
};
