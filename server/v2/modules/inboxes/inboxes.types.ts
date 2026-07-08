// SendSeven custom inbox (a saved view over conversations, filtered by
// channels/tags/fields). Used to drive the inbox switcher in the UI.

export interface SsInbox {
  id: string;
  tenant_id?: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  access_mode?: string | null;
  is_active?: boolean;
  sort_order?: number;
  channel_ids?: string[] | null;
  tag_ids?: string[] | null;
  created_at?: string;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface SsInboxList {
  items: SsInbox[];
}
