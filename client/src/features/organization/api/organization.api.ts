import axiosClient from "@/api/client/axios-client";

export interface OrganizationBillingContact {
  contactEmail?: string;
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  vatNumber?: string;
}

export interface OrganizationSettings {
  timezone?: string;
  currency?: string;
  dateFormat?: string;
  weekStart?: "sunday" | "monday";
  billing?: OrganizationBillingContact;
  [key: string]: unknown;
}

export interface Organization {
  id:           string;
  name:         string;
  slug:         string;
  plan:         "starter" | "growth" | "enterprise" | null;
  isActive:     boolean;
  seatLimit:    number | null;
  brandColor:   string | null;
  logoUrl:      string | null;
  settings:     OrganizationSettings;
  createdAt:    string;
  trialEndsAt:  string | null;
}

export type OrganizationUpdate = Partial<{
  name:       string;
  slug:       string;
  brandColor: string;
  logoUrl:    string | null;
  settings:   OrganizationSettings;
  seatLimit:  number;
  isActive:   boolean;
  plan:       "starter" | "growth" | "enterprise";
}>;

export interface OrgMemberBranch {
  branchId:   string;
  branchName: string;
  orgRole:    string;
  isActive:   boolean;
}

export interface OrgMember {
  user: {
    id: string;
    name: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    image: string | null;
    emailVerified: boolean;
    banned: boolean | null;
    orgRole: string | null;
  };
  branches: OrgMemberBranch[];
}

export const organizationApi = {
  getMine: async (): Promise<Organization> => {
    const { data } = await axiosClient.get<Organization>("/api/v2/organizations/me");
    return data;
  },

  updateMine: async (patch: OrganizationUpdate): Promise<Organization> => {
    const { data } = await axiosClient.patch<Organization>("/api/v2/organizations/me", patch);
    return data;
  },

  listMembers: async (): Promise<OrgMember[]> => {
    const { data } = await axiosClient.get<OrgMember[]>("/api/v2/organizations/me/members");
    return data;
  },

  updateMemberRole: async (userId: string, orgRole: string): Promise<{ userId: string; orgRole: string }> => {
    const { data } = await axiosClient.patch(`/api/v2/organizations/me/members/${userId}/role`, { orgRole });
    return data;
  },

  setMemberSuspended: async (userId: string, suspended: boolean): Promise<{ userId: string; suspended: boolean }> => {
    const { data } = await axiosClient.patch(`/api/v2/organizations/me/members/${userId}/suspended`, { suspended });
    return data;
  },

  assignBranch: async (userId: string, branchId: string, orgRole?: string) => {
    const { data } = await axiosClient.post(`/api/v2/organizations/me/members/${userId}/branches`, { branchId, orgRole });
    return data;
  },

  unassignBranch: async (userId: string, branchId: string) => {
    await axiosClient.delete(`/api/v2/organizations/me/members/${userId}/branches/${branchId}`);
  },
};
