import { AppError } from "../../utils/error-handler";
import {
  whatsappSettingsRepository,
  type LegacyWhatsappSettingsRow,
  type PinResetSettingsRow,
  type WhatsappSettingsInput,
  type WhatsappSettingsWritten,
} from "./whatsapp-settings.repository";
import type { AutoMessagePurpose, PurposeTemplateConfig, PurposeTemplates } from "@shared/schema";
import type { TemplateSettingsKind, WhatsappTemplateSettings } from "./whatsapp-templates.types";

// Settings for the three org-level WhatsApp templates: the one a quote link goes
// out in, the "General update" one agents use once the 24h window has closed, and
// the "Portal sign-in link" one sent when a customer asks "Forgotten your PIN?".

const EMPTY: WhatsappTemplateSettings = { templateName: null, templateLanguage: null, channelId: null, variables: {} };

function toSettings(row: Partial<LegacyWhatsappSettingsRow> | null, kind: "quote" | "update"): WhatsappTemplateSettings {
  if (!row) return { ...EMPTY };
  if (kind === "quote") {
    return {
      templateName: row.quoteTemplateName ?? null,
      templateLanguage: row.quoteTemplateLanguage ?? null,
      channelId: row.quoteTemplateChannelId ?? null,
      variables: row.quoteTemplateVariables ?? {},
    };
  }
  return {
    templateName: row.updateTemplateName ?? null,
    templateLanguage: row.updateTemplateLanguage ?? null,
    channelId: row.updateTemplateChannelId ?? null,
    variables: row.updateTemplateVariables ?? {},
  };
}

function toPinResetSettings(row: Partial<PinResetSettingsRow> | null): WhatsappTemplateSettings {
  if (!row) return { ...EMPTY };
  return {
    templateName: row.pinResetTemplateName ?? null,
    templateLanguage: row.pinResetTemplateLanguage ?? null,
    channelId: row.pinResetTemplateChannelId ?? null,
    variables: row.pinResetTemplateVariables ?? {},
  };
}

// No template chosen: clear everything of that kind so stale placeholders never linger.
function toColumns(input: WhatsappTemplateSettings, kind: TemplateSettingsKind): WhatsappSettingsInput {
  const cleared = input.templateName === null;
  const name = cleared ? null : input.templateName;
  const language = cleared ? null : input.templateLanguage;
  const channelId = cleared ? null : input.channelId;
  const variables = cleared ? {} : input.variables;
  if (kind === "quote") {
    return { quoteTemplateName: name, quoteTemplateLanguage: language, quoteTemplateChannelId: channelId, quoteTemplateVariables: variables };
  }
  if (kind === "pinReset") {
    return { pinResetTemplateName: name, pinResetTemplateLanguage: language, pinResetTemplateChannelId: channelId, pinResetTemplateVariables: variables };
  }
  return { updateTemplateName: name, updateTemplateLanguage: language, updateTemplateChannelId: channelId, updateTemplateVariables: variables };
}

function fromSaved(row: WhatsappSettingsWritten, kind: TemplateSettingsKind): WhatsappTemplateSettings {
  return kind === "pinReset" ? toPinResetSettings(row) : toSettings(row, kind);
}

/** Postgres "undefined_column" (42703), possibly wrapped by the driver. */
function isUndefinedColumn(err: unknown): boolean {
  const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);
  const cause = typeof err === "object" && err !== null ? (err as { cause?: unknown }).cause : undefined;
  return codeOf(err) === "42703" || codeOf(cause) === "42703";
}

async function save(
  orgId: string,
  input: WhatsappTemplateSettings,
  userId: string | null,
  kind: TemplateSettingsKind,
): Promise<WhatsappTemplateSettings> {
  try {
    return fromSaved(await whatsappSettingsRepository.upsert(orgId, toColumns(input, kind), userId), kind);
  } catch (err) {
    // Only the sign-in link template needs the new columns; the quote and update saves never name them.
    if (kind === "pinReset" && isUndefinedColumn(err)) {
      throw new AppError("The sign-in link template can't be saved until the latest database update has been applied.", 503);
    }
    throw err;
  }
}

// ── Per-message-type templates (booking confirmation, portal ready, reminders) ──

/** Logged at most this often while the purpose_templates column is missing. */
const MISSING_COLUMN_LOG_INTERVAL_MS = 60_000;
let lastMissingColumnLogAt = 0;

/** Logged at most once a minute while a not-yet-pushed column is missing. */
function warnMissingColumn(column: string): void {
  const now = Date.now();
  if (now - lastMissingColumnLogAt < MISSING_COLUMN_LOG_INTERVAL_MS) return;
  lastMissingColumnLogAt = now;
  console.warn(`[whatsapp-settings] org_whatsapp_settings.${column} is not in the database yet; treating it as empty`);
}

function toPurposeSettings(config: PurposeTemplateConfig | undefined): WhatsappTemplateSettings {
  if (!config) return { ...EMPTY };
  return {
    templateName: config.templateName ?? null,
    templateLanguage: config.language ?? null,
    channelId: config.channelId ?? null,
    variables: config.variables ?? {},
  };
}

/** Every message type's template. Before the column exists this is empty (no template chosen), never an error. */
async function getPurposeTemplates(orgId: string): Promise<PurposeTemplates> {
  try {
    return await whatsappSettingsRepository.findPurposeTemplatesByOrg(orgId);
  } catch (err) {
    if (!isUndefinedColumn(err)) throw err;
    warnMissingColumn("purpose_templates");
    return {};
  }
}

async function savePurposeTemplate(orgId: string, purpose: AutoMessagePurpose, input: WhatsappTemplateSettings, userId: string | null): Promise<WhatsappTemplateSettings> {
  const cleared = input.templateName === null;
  const config: PurposeTemplateConfig = {
    templateName: cleared ? null : input.templateName,
    language: cleared ? null : input.templateLanguage,
    channelId: cleared ? null : input.channelId,
    variables: cleared ? {} : input.variables,
  };
  try {
    const saved = await whatsappSettingsRepository.upsertPurposeTemplate(orgId, purpose, config, userId);
    return toPurposeSettings(saved[purpose]);
  } catch (err) {
    if (isUndefinedColumn(err)) {
      throw new AppError("Automatic message templates can't be saved until the latest database update has been applied.", 503);
    }
    throw err;
  }
}

/**
 * The portal sign-in link template. Before the sign-in link columns exist in the database this is empty (no template
 * chosen), never an error, so the Integrations page and the sender keep working.
 */
async function getPinReset(orgId: string): Promise<WhatsappTemplateSettings> {
  try {
    return toPinResetSettings(await whatsappSettingsRepository.findPinResetByOrg(orgId));
  } catch (err) {
    if (!isUndefinedColumn(err)) throw err;
    warnMissingColumn("pin_reset_template_*");
    return { ...EMPTY };
  }
}

export const whatsappSettingsService = {
  getPurposeTemplates,
  getPurposeTemplate: async (orgId: string, purpose: AutoMessagePurpose) => toPurposeSettings((await getPurposeTemplates(orgId))[purpose]),
  savePurposeTemplate,
  getQuote: async (orgId: string) => toSettings(await whatsappSettingsRepository.findByOrg(orgId), "quote"),
  saveQuote: (orgId: string, input: WhatsappTemplateSettings, userId: string | null) => save(orgId, input, userId, "quote"),
  getUpdate: async (orgId: string) => toSettings(await whatsappSettingsRepository.findByOrg(orgId), "update"),
  saveUpdate: (orgId: string, input: WhatsappTemplateSettings, userId: string | null) => save(orgId, input, userId, "update"),
  getPinReset,
  savePinReset: (orgId: string, input: WhatsappTemplateSettings, userId: string | null) => save(orgId, input, userId, "pinReset"),
};
