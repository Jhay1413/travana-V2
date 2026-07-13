import { conversationIntegrationRepository } from "../conversation-integration/conversation-integration.repository";
import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";
import { botConfigRepository, type BotConfigInput } from "./bot-config.repository";
import type { OrgBotConfig } from "@shared/schema";

// Combined view of the bot: its persona/config (org_bot_config) + the live
// auto-reply status (sendseven_integrations). `provisioned` tells the UI whether
// a SendSeven sub-account exists yet (required before enabling).
export interface BotStatus {
  config: OrgBotConfig | null;
  autoReply: { enabled: boolean; mode: string; provisioned: boolean };
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
      },
    };
  },

  async update(orgId: string, data: BotConfigInput, userId: string | null): Promise<BotStatus> {
    await botConfigRepository.upsert(orgId, data, userId);
    return this.getStatus(orgId);
  },

  // Registers the webhook + turns auto-reply on (delegates to the webhook service).
  async enable(orgId: string, mode: string | undefined): Promise<BotStatus> {
    await sendsevenWebhookService.enableAutoReply(orgId, { mode });
    return this.getStatus(orgId);
  },

  async disable(orgId: string): Promise<BotStatus> {
    await sendsevenWebhookService.disableAutoReply(orgId);
    return this.getStatus(orgId);
  },

  async setMode(orgId: string, mode: string): Promise<BotStatus> {
    await conversationIntegrationRepository.setAutoReplyMode(orgId, mode);
    return this.getStatus(orgId);
  },
};
