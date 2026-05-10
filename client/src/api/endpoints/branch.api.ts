import axiosClient from "../client/axios-client";

export interface BranchOpeningHour {
  day:       string;
  open:      boolean;
  openTime:  string;
  closeTime: string;
}

export type BranchOpeningPattern = "mon-fri" | "mon-sat" | "seven-days";

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
  list: async (): Promise<Branch[]> => {
    const { data } = await axiosClient.get<Branch[]>("/api/v2/branches");
    return data;
  },
  getById: async (id: string): Promise<Branch> => {
    const { data } = await axiosClient.get<Branch>(`/api/v2/branches/${id}`);
    return data;
  },
  create: async (input: BranchInput): Promise<Branch> => {
    const { data } = await axiosClient.post<Branch>("/api/v2/branches", input);
    return data;
  },
  update: async (id: string, input: BranchInput): Promise<Branch> => {
    const { data } = await axiosClient.patch<Branch>(`/api/v2/branches/${id}`, input);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/branches/${id}`);
  },
};
