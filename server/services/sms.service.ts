import twilio, { Twilio } from "twilio";

let cachedSettings: { settings: any; expires_at?: string } | null = null;

async function fetchTwilioConnection(): Promise<any | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) return null;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;
  if (!xReplitToken) return null;

  if (
    cachedSettings &&
    cachedSettings.expires_at &&
    new Date(cachedSettings.expires_at).getTime() > Date.now()
  ) {
    return cachedSettings.settings;
  }

  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=twilio`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } }
    );
    const data: any = await res.json().catch(() => ({} as any));
    const item = data?.items?.[0];
    if (!item) return null;
    cachedSettings = { settings: item.settings, expires_at: item.expires_at };
    return item.settings;
  } catch {
    return null;
  }
}

export async function getUncachableTwilioClient(): Promise<{
  client: Twilio;
  fromPhone: string;
}> {
  // Prefer Replit connector if authorised; fall back to plain env vars.
  const settings: any = (await fetchTwilioConnection()) || {};
  const accountSid: string =
    settings.account_sid ||
    settings.accountSid ||
    settings.sid ||
    settings.username ||
    process.env.TWILIO_ACCOUNT_SID ||
    "";
  const authToken: string =
    settings.auth_token ||
    settings.authToken ||
    settings.password ||
    process.env.TWILIO_AUTH_TOKEN ||
    "";
  const fromPhone: string =
    settings.phone_number ||
    settings.phoneNumber ||
    settings.from_number ||
    process.env.TWILIO_PHONE_NUMBER ||
    "";
  if (!accountSid || !authToken) {
    throw new Error(
      "Twilio is not connected. Either authorise the Twilio integration or set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER as project secrets."
    );
  }
  return { client: twilio(accountSid, authToken), fromPhone };
}

export interface MergeContext {
  first_name?: string | null;
  last_name?: string | null;
  destination?: string | null;
  departure_date?: string | null;
  balance_due?: string | number | null;
  balance_due_date?: string | null;
  hays_ref?: string | null;
  supplier_ref?: string | null;
  portal_link?: string | null;
  agent_name?: string | null;
  company_name?: string | null;
  [key: string]: string | number | null | undefined;
}

export function mergeTemplate(body: string, ctx: MergeContext): string {
  return body.replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (_m, key) => {
    const value = ctx[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function normalisePhone(raw: string | null | undefined, defaultCountry = "GB"): string | null {
  if (!raw) return null;
  let p = String(raw).trim().replace(/[^\d+]/g, "");
  if (!p) return null;
  if (p.startsWith("+")) return p;
  if (defaultCountry === "GB") {
    if (p.startsWith("00")) return "+" + p.slice(2);
    if (p.startsWith("0")) return "+44" + p.slice(1);
    if (p.startsWith("44")) return "+" + p;
    return "+44" + p;
  }
  return "+" + p;
}

export interface SendSmsArgs {
  to: string;
  body: string;
}

export async function sendSms({
  to,
  body,
}: SendSmsArgs): Promise<{ sid: string; status: string }> {
  const { client, fromPhone } = await getUncachableTwilioClient();
  if (!fromPhone) {
    throw new Error(
      "No Twilio sender phone number is configured on the connector. Please add a phone number in the Twilio dashboard."
    );
  }
  const message = await client.messages.create({ from: fromPhone, to, body });
  return { sid: message.sid, status: message.status };
}

export async function pingTwilioConnection(): Promise<{ connected: boolean; fromPhone?: string; error?: string }> {
  try {
    const { fromPhone } = await getUncachableTwilioClient();
    return { connected: true, fromPhone };
  } catch (err: any) {
    return { connected: false, error: err?.message ?? String(err) };
  }
}
