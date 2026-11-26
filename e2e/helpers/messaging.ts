/**
 * Setup helpers for the automatic customer message specs. Rows are written straight to the practice database;
 * the specs assert through the real screens, the real endpoints and the fake providers (fake-providers.ts).
 *
 * The suite must end with no SendSeven / WhatsApp settings in the database (global teardown checks it), so every
 * spec that connects an agency calls `disconnectAll()` in afterAll.
 */
import "./test-db-env";
import { randomUUID } from "node:crypto";
import { encrypt } from "../../server/v2/utils/encryption";
import { buildServerEnv } from "./env";
import { FAKE_PROVIDERS_URL, FAKE_SENDSEVEN_TOKEN } from "./fake-providers";
import { queryRows } from "./seed";

// The token is encrypted with the key the test server holds.
process.env.EMAIL_ENCRYPTION_KEY = buildServerEnv().EMAIL_ENCRYPTION_KEY;

const connectedOrgs = new Set<string>();

export type PurposeKey = "booking_confirmation" | "portal_ready" | "balance_reminder" | "departure_reminder";

/** Gives the agency a SendSeven workspace whose address is the loopback fake (so its WhatsApp channel and templates exist). */
export async function connectFakeWhatsapp(orgId: string): Promise<void> {
  await queryRows(
    `insert into sendseven_integrations (id, org_id, encrypted_token, base_url, is_active)
     values ($1, $2, $3, $4, true)
     on conflict (org_id) do update set encrypted_token = excluded.encrypted_token, base_url = excluded.base_url, is_active = true`,
    [randomUUID(), orgId, encrypt(FAKE_SENDSEVEN_TOKEN), `${FAKE_PROVIDERS_URL}/sendseven`],
  );
  connectedOrgs.add(orgId);
}

/** Saves one message type's WhatsApp template straight into the settings row. */
export async function saveAutoTemplate(
  orgId: string,
  purpose: PurposeKey,
  config: { templateName: string; language?: string; channelId?: string; variables: Record<string, { source: string; text?: string }> },
): Promise<void> {
  const value = { [purpose]: { templateName: config.templateName, language: config.language ?? "en_GB", channelId: config.channelId ?? "fake-wa-channel", variables: config.variables } };
  await queryRows(
    `insert into org_whatsapp_settings (org_id, purpose_templates) values ($1, $2::jsonb)
     on conflict (org_id) do update set purpose_templates = coalesce(org_whatsapp_settings.purpose_templates, '{}'::jsonb) || excluded.purpose_templates`,
    [orgId, JSON.stringify(value)],
  );
  connectedOrgs.add(orgId);
}

/** An active SMS template row: the on/off switch of a message type, on both channels. */
export async function switchOn(
  orgId: string,
  trigger: "on_booking_create" | "on_pin_set" | "days_before_departure",
  category: string,
  body = "Hi {{first_name}}, your booking {{hays_ref}} is confirmed.",
): Promise<string> {
  const id = randomUUID();
  await queryRows(
    `insert into sms_templates (id, org_id, name, category, body, auto_trigger, active)
     values ($1, $2, $3, $4, $5, $6, true)`,
    [id, orgId, `E2E ${trigger} ${id.slice(0, 6)}`, category, body, trigger],
  );
  return id;
}

/** Writes the agency's channel choice straight into its settings (the specs also drive the real endpoint and screen). */
export async function setStoredChannel(orgId: string, autoChannel: "whatsapp" | "sms"): Promise<void> {
  await queryRows(
    `update organization set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('messaging', jsonb_build_object('autoChannel', $2::text)) where id = $1`,
    [orgId, autoChannel],
  );
}

export async function optOut(clientId: string): Promise<void> {
  await queryRows(`update client_table set sms_opt_in = false where id = $1`, [clientId]);
}

export interface LogRow {
  purpose: string;
  channel: string;
  status: string;
  reason: string | null;
  template_name: string | null;
  trigger_source: string | null;
}

export async function logRows(clientId: string): Promise<LogRow[]> {
  return queryRows<LogRow>(
    `select purpose, channel, status, reason, template_name, trigger_source from customer_message_log where client_id = $1 order by created_at`,
    [clientId],
  );
}

/** Removes every messaging setting this run wrote (call from afterAll, so a failing test still cleans up). */
export async function disconnectAll(): Promise<void> {
  const ids = [...connectedOrgs];
  connectedOrgs.clear();
  if (ids.length === 0) return;
  await queryRows(`delete from sendseven_integrations where org_id = any($1::uuid[])`, [ids]);
  await queryRows(`delete from org_whatsapp_settings where org_id = any($1::uuid[])`, [ids]);
}

/** Saves the agency's quote-link WhatsApp template (used when the 24 hour window is closed / the client has no chat). */
export async function saveQuoteTemplate(orgId: string, templateName = "portal_ready_msg"): Promise<void> {
  await queryRows(
    `insert into org_whatsapp_settings (org_id, quote_template_name, quote_template_language, quote_template_channel_id, quote_template_variables)
     values ($1, $2, 'en_GB', 'fake-wa-channel', $3::jsonb)
     on conflict (org_id) do update set quote_template_name = excluded.quote_template_name, quote_template_language = excluded.quote_template_language,
       quote_template_channel_id = excluded.quote_template_channel_id, quote_template_variables = excluded.quote_template_variables`,
    [orgId, templateName, JSON.stringify({ "1": { source: "client_first_name" }, "2": { source: "quote_link" } })],
  );
  connectedOrgs.add(orgId);
}

/** Saves the agency's "Portal sign-in link" WhatsApp template (customer-requested and staff-sent links both use it). */
export async function savePinResetTemplate(orgId: string, templateName = "portal_ready_msg"): Promise<void> {
  await queryRows(
    `insert into org_whatsapp_settings (org_id, pin_reset_template_name, pin_reset_template_language, pin_reset_template_channel_id, pin_reset_template_variables)
     values ($1, $2, 'en_GB', 'fake-wa-channel', $3::jsonb)
     on conflict (org_id) do update set pin_reset_template_name = excluded.pin_reset_template_name, pin_reset_template_language = excluded.pin_reset_template_language,
       pin_reset_template_channel_id = excluded.pin_reset_template_channel_id, pin_reset_template_variables = excluded.pin_reset_template_variables`,
    [orgId, templateName, JSON.stringify({ "1": { source: "client_first_name" }, "2": { source: "sign_in_link" } })],
  );
  connectedOrgs.add(orgId);
}
