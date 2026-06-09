import axios from "../client/axios-client";

const BASE = "/api/v2/sms";

export type SmsTemplateCategory =
  | "weekly_deals"
  | "balance_due"
  | "booking_confirmation"
  | "tickets_ready"
  | "portal_login"
  | "quote_link"
  | "custom";

export type SmsAutoTrigger =
  | "manual"
  | "on_booking_create"
  | "on_pin_set"
  | "days_before_departure";

export interface SmsTemplate {
  id: string;
  name: string;
  category: SmsTemplateCategory;
  body: string;
  autoTrigger: SmsAutoTrigger;
  triggerDaysBefore: number | null;
  triggerWeekday: number | null;
  triggerHour: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmsTemplateInput {
  name: string;
  category: SmsTemplateCategory;
  body: string;
  autoTrigger: SmsAutoTrigger;
  triggerDaysBefore: number | null;
  triggerWeekday: number | null;
  triggerHour: number | null;
  active: boolean;
}

export type SmsRecipientFilter =
  | { mode: "client"; clientId: string }
  | { mode: "all_optin" }
  | { mode: "vip_tier"; vipTier: string }
  | { mode: "badge"; badge: string }
  | { mode: "list"; clientIds: string[] };

export interface SendSmsInput {
  templateId?: string;
  /** Resolve the template by category server-side (org's own, else default). */
  category?: SmsTemplateCategory;
  bodyOverride?: string;
  recipients: SmsRecipientFilter;
  triggerSource?: string;
  confirmBulk?: boolean;
  /** Send the PUBLIC /view-quote link instead of the portal one (no login/PIN). */
  publicQuoteLink?: boolean;
}

export interface SendSmsResult {
  sent: number;
  skipped: number;
  failed: number;
  total?: number;
  results: Array<{ clientId: string; status: string; sid?: string; error?: string }>;
}

export const smsApi = {
  async listTemplates(): Promise<SmsTemplate[]> {
    const { data } = await axios.get(`${BASE}/templates`);
    return Array.isArray(data) ? data : [];
  },

  async createTemplate(input: SmsTemplateInput): Promise<SmsTemplate> {
    const { data } = await axios.post(`${BASE}/templates`, input);
    return data;
  },

  async updateTemplate(id: string, input: SmsTemplateInput): Promise<SmsTemplate> {
    const { data } = await axios.put(`${BASE}/templates/${id}`, input);
    return data;
  },

  async deleteTemplate(id: string): Promise<void> {
    await axios.delete(`${BASE}/templates/${id}`);
  },

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const { data } = await axios.post(`${BASE}/send`, input);
    return data;
  },
};
