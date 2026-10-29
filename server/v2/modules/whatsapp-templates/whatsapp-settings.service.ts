import type { OrgWhatsappSettings } from "@shared/schema";
import { whatsappSettingsRepository, type WhatsappSettingsInput } from "./whatsapp-settings.repository";
import type { TemplateSettingsKind, WhatsappTemplateSettings } from "./whatsapp-templates.types";

// Settings for the two org-level WhatsApp templates: the one a quote link goes
// out in and the "General update" one agents use once the 24h window has closed.

function toSettings(row: OrgWhatsappSettings | null, kind: TemplateSettingsKind): WhatsappTemplateSettings {
  if (!row) return { templateName: null, templateLanguage: null, channelId: null, variables: {} };
  if (kind === "quote") {
    return {
      templateName: row.quoteTemplateName,
      templateLanguage: row.quoteTemplateLanguage,
      channelId: row.quoteTemplateChannelId,
      variables: row.quoteTemplateVariables ?? {},
    };
  }
  return {
    templateName: row.updateTemplateName,
    templateLanguage: row.updateTemplateLanguage,
    channelId: row.updateTemplateChannelId,
    variables: row.updateTemplateVariables ?? {},
  };
}

// No template chosen: clear everything of that kind so stale placeholders never linger.
function toColumns(input: WhatsappTemplateSettings, kind: TemplateSettingsKind): WhatsappSettingsInput {
  const cleared = input.templateName === null;
  const name = cleared ? null : input.templateName;
  const language = cleared ? null : input.templateLanguage;
  const channelId = cleared ? null : input.channelId;
  const variables = cleared ? {} : input.variables;
  return kind === "quote"
    ? { quoteTemplateName: name, quoteTemplateLanguage: language, quoteTemplateChannelId: channelId, quoteTemplateVariables: variables }
    : { updateTemplateName: name, updateTemplateLanguage: language, updateTemplateChannelId: channelId, updateTemplateVariables: variables };
}

async function get(orgId: string, kind: TemplateSettingsKind): Promise<WhatsappTemplateSettings> {
  return toSettings(await whatsappSettingsRepository.findByOrg(orgId), kind);
}

async function save(
  orgId: string,
  input: WhatsappTemplateSettings,
  userId: string | null,
  kind: TemplateSettingsKind,
): Promise<WhatsappTemplateSettings> {
  return toSettings(await whatsappSettingsRepository.upsert(orgId, toColumns(input, kind), userId), kind);
}

export const whatsappSettingsService = {
  getQuote: (orgId: string) => get(orgId, "quote"),
  saveQuote: (orgId: string, input: WhatsappTemplateSettings, userId: string | null) => save(orgId, input, userId, "quote"),
  getUpdate: (orgId: string) => get(orgId, "update"),
  saveUpdate: (orgId: string, input: WhatsappTemplateSettings, userId: string | null) => save(orgId, input, userId, "update"),
};
