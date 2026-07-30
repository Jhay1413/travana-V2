import { conversationIntegrationRepository } from "../conversation-integration/conversation-integration.repository";
import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";
import { botConfigRepository, type BotConfigInput } from "./bot-config.repository";
import type { OrgBotConfig } from "@shared/schema";

// Combined view of the bot: its persona/config (org_bot_config) + the live
// auto-reply status (sendseven_integrations). `provisioned` tells the UI whether
// a SendSeven sub-account exists yet (required before enabling).
export interface BotStatus {
  config: OrgBotConfig | null;
  autoReply: {
    enabled: boolean;
    mode: string;
    provisioned: boolean;
    /** Webhook registered with SendSeven. Independent of `enabled`: connected
     *  with the bot off = live inbox updates, no AI replies. */
    webhookConnected: boolean;
  };
}

export const botConfigService = {
  async getStatus(orgId: string): Promise<BotStatus> {
    const [config, integration] = await Promise.all([
      botConfigRepository.findByOrg(orgId),
      conversationIntegrationRepository.findByOrg(orgId),
    ]);
    // "provisioned" = the webhook can be registered: the org has a SendSeven
    // connection (a linked tenant, a manual token, or the global env fallback).
    const hasEnvFallback = !!(process.env.CONVERSATIONS_API_URL && process.env.CONVERSATIONS_API_TOKEN);
    const provisioned = !!integration?.tenantId || !!integration?.encryptedToken || hasEnvFallback;
    return {
      config,
      autoReply: {
        enabled: !!integration?.autoReplyEnabled,
        mode: integration?.autoReplyMode ?? "draft",
        provisioned,
        webhookConnected: !!integration?.webhookSecret,
      },
    };
  },

  async update(orgId: string, data: BotConfigInput, userId: string | null): Promise<BotStatus> {
    await botConfigRepository.upsert(orgId, data, userId);
    return this.getStatus(orgId);
  },

  // Turns the AI on (registering the webhook first if it isn't connected yet).
  async enable(orgId: string, mode: string | undefined): Promise<BotStatus> {
    await sendsevenWebhookService.setAutoReply(orgId, true, { mode });
    return this.getStatus(orgId);
  },

  // Silences the bot but LEAVES the webhook connected, so the inbox keeps
  // updating live. Use disconnectWebhook to stop deliveries entirely.
  async disable(orgId: string): Promise<BotStatus> {
    await sendsevenWebhookService.setAutoReply(orgId, false);
    return this.getStatus(orgId);
  },

  // The webhook switch itself — independent of the bot. No `autoReply` flag, so
  // connecting never changes the bot's state: a fresh org lands on the column
  // default (off) and re-connecting an existing one leaves it as the admin set it.
  async connectWebhook(orgId: string): Promise<BotStatus> {
    await sendsevenWebhookService.connectWebhook(orgId);
    return this.getStatus(orgId);
  },

  async disconnectWebhook(orgId: string): Promise<BotStatus> {
    await sendsevenWebhookService.disconnectWebhook(orgId);
    return this.getStatus(orgId);
  },

  async setMode(orgId: string, mode: string): Promise<BotStatus> {
    await conversationIntegrationRepository.setAutoReplyMode(orgId, mode);
    return this.getStatus(orgId);
  },
};
