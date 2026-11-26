import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/database";
import {
  orgWhatsappSettings,
  type AutoMessagePurpose,
  type OrgWhatsappSettings,
  type InsertOrgWhatsappSettings,
  type PurposeTemplateConfig,
  type PurposeTemplates,
} from "@shared/schema";

// Repository: one WhatsApp-settings row per org (org_whatsapp_settings). It holds
// the quote template, the general-update template and the portal sign-in link
// template; a write only sets the columns it is given, so saving one never
// overwrites the others.

export type WhatsappSettingsInput = Partial<
  Pick<
    InsertOrgWhatsappSettings,
    | "quoteTemplateName"
    | "quoteTemplateLanguage"
    | "quoteTemplateChannelId"
    | "quoteTemplateVariables"
    | "updateTemplateName"
    | "updateTemplateLanguage"
    | "updateTemplateChannelId"
    | "updateTemplateVariables"
    | "pinResetTemplateName"
    | "pinResetTemplateLanguage"
    | "pinResetTemplateChannelId"
    | "pinResetTemplateVariables"
  >
>;

/** The quote/update columns only: the existing quote and update sends never read the sign-in link columns. */
export type LegacyWhatsappSettingsRow = Pick<
  OrgWhatsappSettings,
  | "quoteTemplateName"
  | "quoteTemplateLanguage"
  | "quoteTemplateChannelId"
  | "quoteTemplateVariables"
  | "updateTemplateName"
  | "updateTemplateLanguage"
  | "updateTemplateChannelId"
  | "updateTemplateVariables"
>;

export type PinResetSettingsRow = Pick<
  OrgWhatsappSettings,
  "pinResetTemplateName" | "pinResetTemplateLanguage" | "pinResetTemplateChannelId" | "pinResetTemplateVariables"
>;

/** What an upsert hands back: exactly the columns that were written, as stored. */
export type WhatsappSettingsWritten = WhatsappSettingsInput;

interface ColumnSpec {
  col: string;
  json?: true;
}

// Fixed identifiers (never user input), so they are safe to splice into the statement.
const COLUMNS: Record<keyof WhatsappSettingsInput, ColumnSpec> = {
  quoteTemplateName: { col: "quote_template_name" },
  quoteTemplateLanguage: { col: "quote_template_language" },
  quoteTemplateChannelId: { col: "quote_template_channel_id" },
  quoteTemplateVariables: { col: "quote_template_variables", json: true },
  updateTemplateName: { col: "update_template_name" },
  updateTemplateLanguage: { col: "update_template_language" },
  updateTemplateChannelId: { col: "update_template_channel_id" },
  updateTemplateVariables: { col: "update_template_variables", json: true },
  pinResetTemplateName: { col: "pin_reset_template_name" },
  pinResetTemplateLanguage: { col: "pin_reset_template_language" },
  pinResetTemplateChannelId: { col: "pin_reset_template_channel_id" },
  pinResetTemplateVariables: { col: "pin_reset_template_variables", json: true },
};

type WrittenKey = keyof WhatsappSettingsInput;

function writtenKeys(data: WhatsappSettingsInput): WrittenKey[] {
  return (Object.keys(COLUMNS) as WrittenKey[]).filter((k) => data[k] !== undefined);
}

/**
 * The upsert statement. It names ONLY the columns being written (and returns only those), unlike a
 * Drizzle insert, which lists every column of the table. So saving the quote or general-update template
 * works in a database that has not yet had the sign-in link columns added.
 */
export function buildUpsertQuery(orgId: string, data: WhatsappSettingsInput, userId: string | null): SQL {
  const keys = writtenKeys(data);
  const cols = keys.map((k) => sql.raw(COLUMNS[k].col));
  const values = keys.map((k) => (COLUMNS[k].json ? sql`${JSON.stringify(data[k])}::jsonb` : sql`${data[k] ?? null}`));
  const updates = keys.map((k) => sql`${sql.raw(COLUMNS[k].col)} = excluded.${sql.raw(COLUMNS[k].col)}`);
  const returning = keys.length > 0 ? sql.join(cols, sql`, `) : sql`org_id`;
  return sql`insert into org_whatsapp_settings (org_id, updated_by${keys.length ? sql`, ${sql.join(cols, sql`, `)}` : sql``})
    values (${orgId}, ${userId}${keys.length ? sql`, ${sql.join(values, sql`, `)}` : sql``})
    on conflict (org_id) do update set updated_by = excluded.updated_by, updated_at = now()${updates.length ? sql`, ${sql.join(updates, sql`, `)}` : sql``}
    returning ${returning}`;
}

/**
 * Saves ONE message type's template into the purpose_templates jsonb, merging it atomically into whatever is
 * stored (other types are never touched). Names only purpose_templates, so nothing else in the table depends on it.
 */
export function buildPurposeTemplateUpsert(orgId: string, purpose: AutoMessagePurpose, config: PurposeTemplateConfig, userId: string | null): SQL {
  const patch = JSON.stringify({ [purpose]: config });
  return sql`insert into org_whatsapp_settings (org_id, updated_by, purpose_templates)
    values (${orgId}, ${userId}, ${patch}::jsonb)
    on conflict (org_id) do update set updated_by = excluded.updated_by, updated_at = now(),
      purpose_templates = coalesce(org_whatsapp_settings.purpose_templates, '{}'::jsonb) || excluded.purpose_templates
    returning purpose_templates`;
}

function fromDbRow(row: Record<string, unknown>, keys: WrittenKey[]): WhatsappSettingsWritten {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = row[COLUMNS[k].col] ?? (COLUMNS[k].json ? {} : null);
  return out as WhatsappSettingsWritten;
}

export const whatsappSettingsRepository = {
  /**
   * Explicit columns: quote and update sends keep working in a database that has not
   * yet had the sign-in link columns added.
   */
  async findByOrg(orgId: string): Promise<LegacyWhatsappSettingsRow | null> {
    const [row] = await db
      .select({
        quoteTemplateName: orgWhatsappSettings.quoteTemplateName,
        quoteTemplateLanguage: orgWhatsappSettings.quoteTemplateLanguage,
        quoteTemplateChannelId: orgWhatsappSettings.quoteTemplateChannelId,
        quoteTemplateVariables: orgWhatsappSettings.quoteTemplateVariables,
        updateTemplateName: orgWhatsappSettings.updateTemplateName,
        updateTemplateLanguage: orgWhatsappSettings.updateTemplateLanguage,
        updateTemplateChannelId: orgWhatsappSettings.updateTemplateChannelId,
        updateTemplateVariables: orgWhatsappSettings.updateTemplateVariables,
      })
      .from(orgWhatsappSettings)
      .where(eq(orgWhatsappSettings.orgId, orgId));
    return row ?? null;
  },

  async findPinResetByOrg(orgId: string): Promise<PinResetSettingsRow | null> {
    const [row] = await db
      .select({
        pinResetTemplateName: orgWhatsappSettings.pinResetTemplateName,
        pinResetTemplateLanguage: orgWhatsappSettings.pinResetTemplateLanguage,
        pinResetTemplateChannelId: orgWhatsappSettings.pinResetTemplateChannelId,
        pinResetTemplateVariables: orgWhatsappSettings.pinResetTemplateVariables,
      })
      .from(orgWhatsappSettings)
      .where(eq(orgWhatsappSettings.orgId, orgId));
    return row ?? null;
  },

  /**
   * The per-message-type templates. Throws Postgres 42703 while purpose_templates is not in the database yet;
   * callers fail closed (no template chosen).
   */
  async findPurposeTemplatesByOrg(orgId: string): Promise<PurposeTemplates> {
    const [row] = await db
      .select({ purposeTemplates: orgWhatsappSettings.purposeTemplates })
      .from(orgWhatsappSettings)
      .where(eq(orgWhatsappSettings.orgId, orgId));
    return row?.purposeTemplates ?? {};
  },

  async upsertPurposeTemplate(orgId: string, purpose: AutoMessagePurpose, config: PurposeTemplateConfig, userId: string | null): Promise<PurposeTemplates> {
    const result = await db.execute(buildPurposeTemplateUpsert(orgId, purpose, config, userId));
    const row = (result.rows[0] ?? {}) as { purpose_templates?: PurposeTemplates | null };
    return row.purpose_templates ?? {};
  },

  /** Writes (and returns) only the given columns; see buildUpsertQuery. */
  async upsert(orgId: string, data: WhatsappSettingsInput, userId: string | null): Promise<WhatsappSettingsWritten> {
    const keys = writtenKeys(data);
    const result = await db.execute(buildUpsertQuery(orgId, data, userId));
    const row = (result.rows[0] ?? {}) as Record<string, unknown>;
    return fromDbRow(row, keys);
  },
};
