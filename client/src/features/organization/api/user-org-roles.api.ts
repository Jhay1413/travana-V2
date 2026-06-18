import axiosClient from "@/api/client/axios-client";
import type { OrgRole } from "@/types/auth/auth.types";

// NOTE: the global response interceptor unwraps the {success,message,data}
// envelope to just the inner data, so axiosResponse.data IS the payload.

export const userOrgRolesApi = {
  listMyRoles: async (): Promise<OrgRole[]> => {
    const { data } = await axiosClient.get<{ roles: OrgRole[] }>("/api/v2/user-org-roles/me");
    return data?.roles ?? [];
  },

  startSelling: async (): Promise<void> => {
    await axiosClient.post("/api/v2/user-org-roles/me/sell");
  },

  stopSelling: async (): Promise<void> => {
    await axiosClient.delete("/api/v2/user-org-roles/me/sell");
  },
};
