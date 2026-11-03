import type { WhatsappTemplateSettings } from "../whatsapp-templates/whatsapp-templates.types";

/** Org-level "General update" template settings as exposed over the API. */
export type UpdateTemplateSettings = WhatsappTemplateSettings;

/** GET /template: whether agents can message a client once the 24h window has closed. */
export interface UpdateTemplateStatus {
  configured: boolean;
  templateName: string | null;
  channelId: string | null;
}

/** GET /conversations/:id/window. `known: false` when SendSeven could not say. */
export type WhatsappUpdateWindow =
  | {
      known: true;
      inWindow: boolean;
      requiresTemplate: boolean;
      remainingSeconds: number | null;
      windowEndAt: string | null;
      lastCustomerMessageAt: string | null;
    }
  | { known: false };

/** Result of both send endpoints. */
export interface SendWhatsappUpdateResult {
  conversationId: string;
  /** False when the window was open and the text went out as a normal message. */
  viaTemplate: boolean;
}
