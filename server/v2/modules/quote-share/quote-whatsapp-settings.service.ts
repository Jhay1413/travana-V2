import type { OrgWhatsappSettings } from "@shared/schema";
import { quoteWhatsappSettingsRepository } from "./quote-whatsapp-settings.repository";
import type { QuoteTemplateSettings } from "./quote-share.types";

function toSettings(row: OrgWhatsappSettings | null): QuoteTemplateSettings {
  if (!row) return { templateName: null, templateLanguage: null, channelId: null, variables: {} };
  return {
    templateName: row.quoteTemplateName,
    templateLanguage: row.quoteTemplateLanguage,
    channelId: row.quoteTemplateChannelId,
    variables: row.quoteTemplateVariables ?? {},
  };
}

export const quoteWhatsappSettingsService = {
  async get(orgId: string): Promise<QuoteTemplateSettings> {
    return toSettings(await quoteWhatsappSettingsRepository.findByOrg(orgId));
  },

  async save(orgId: string, input: QuoteTemplateSettings, userId: string | null): Promise<QuoteTemplateSettings> {
    // No template chosen: clear everything so stale placeholders never linger.
    const cleared = input.templateName === null;
    const row = await quoteWhatsappSettingsRepository.upsert(
      orgId,
      {
        quoteTemplateName: cleared ? null : input.templateName,
        quoteTemplateLanguage: cleared ? null : input.templateLanguage,
        quoteTemplateChannelId: cleared ? null : input.channelId,
        quoteTemplateVariables: cleared ? {} : input.variables,
      },
      userId,
    );
    return toSettings(row);
  },
};
