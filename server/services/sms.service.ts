/**
 * SMS provider — ClickSend.
 *
 * Auth: HTTP Basic with CLICKSEND_USERNAME + CLICKSEND_API_KEY.
 * Sender: CLICKSEND_SENDER (alphanumeric like "TinasTravel", max 11 chars,
 * no spaces — or an E.164 phone number).
 *
 * Docs: https://developers.clicksend.com/docs/rest/v3/
 */

const CLICKSEND_BASE = "https://rest.clicksend.com/v3";

function getCreds(): { username: string; apiKey: string; sender: string } {
  const username = process.env.CLICKSEND_USERNAME ?? "";
  const apiKey = process.env.CLICKSEND_API_KEY ?? "";
  const sender = process.env.CLICKSEND_SENDER ?? "TinasTravel";
  if (!username || !apiKey) {
    throw new Error(
      "ClickSend is not connected. Set CLICKSEND_USERNAME, CLICKSEND_API_KEY, and CLICKSEND_SENDER as project secrets."
    );
  }
  return { username, apiKey, sender };
}

function authHeader(username: string, apiKey: string): string {
  const token = Buffer.from(`${username}:${apiKey}`).toString("base64");
  return `Basic ${token}`;
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

export async function sendSms({ to, body }: SendSmsArgs): Promise<{ sid: string; status: string }> {
  const { username, apiKey, sender } = getCreds();
  const res = await fetch(`${CLICKSEND_BASE}/sms/send`, {
    method: "POST",
    headers: {
      Authorization: authHeader(username, apiKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          source: "tinas-crm",
          from: sender,
          to,
          body,
        },
      ],
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.http_code !== 200) {
    const detail =
      data?.response_msg ||
      data?.data?.messages?.[0]?.status ||
      `HTTP ${res.status}`;
    throw new Error(`ClickSend send failed: ${detail}`);
  }
  const msg = data?.data?.messages?.[0];
  const status = msg?.status ?? "queued";
  if (status && String(status).toUpperCase() !== "SUCCESS" && String(status).toUpperCase() !== "QUEUED") {
    throw new Error(`ClickSend rejected message: ${status} (${msg?.error_text ?? "no detail"})`);
  }
  return { sid: msg?.message_id ?? "", status };
}

export async function pingSmsConnection(): Promise<{ connected: boolean; fromPhone?: string; balance?: string; error?: string }> {
  try {
    const { username, apiKey, sender } = getCreds();
    const res = await fetch(`${CLICKSEND_BASE}/account`, {
      headers: {
        Authorization: authHeader(username, apiKey),
        Accept: "application/json",
      },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.http_code !== 200) {
      return { connected: false, error: data?.response_msg || `HTTP ${res.status}` };
    }
    const balanceNum = data?.data?.balance;
    return {
      connected: true,
      fromPhone: sender,
      balance: balanceNum !== undefined ? `$${Number(balanceNum).toFixed(2)} USD` : undefined,
    };
  } catch (err: any) {
    return { connected: false, error: err?.message ?? String(err) };
  }
}
