import axiosClient from "@/api/client/axios-client";

// SendSeven custom inboxes for the logged-in org (proxied; uses the org token).

export interface SsInbox {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  is_active?: boolean;
  sort_order?: number;
  channel_ids?: string[] | null;
  tag_ids?: string[] | null;
}

export interface SsInboxList {
  items: SsInbox[];
}

export const inboxesApi = {
  list: async (): Promise<SsInboxList> => {
    const { data } = await axiosClient.get<SsInboxList>("/api/v2/inboxes");
    return data;
  },
};
