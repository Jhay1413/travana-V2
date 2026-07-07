import { AsyncLocalStorage } from "node:async_hooks";
import { AppError } from "./error-handler";

// Shared low-level client for the SendSeven API. Both the conversations and
// messages modules proxy through this so the Bearer token + base URL live in
// one place and never reach the browser.
//
// Multi-tenant: each org has its own SendSeven workspace token. A per-request
// context (set by the conversation-integration middleware) carries the resolved
// config so every proxied call uses the logged-in org's token. When no org
// token is set, we fall back to the global env token (dev/single-tenant).
//
// Env:
//   CONVERSATIONS_API_URL       base URL (e.g. https://api.sendseven.com/api/v1)
//   CONVERSATIONS_API_TOKEN     global fallback Bearer token (optional in prod)
//   CONVERSATIONS_DISABLE_FIXTURES  set "true" to 503 instead of serving samples

export interface SendSevenConfig {
  baseUrl: string;
  token: string;
}

type QueryValue = string | number | boolean | undefined | null;
export type SsQuery = Record<string, QueryValue>;

const tenantContext = new AsyncLocalStorage<{ config: SendSevenConfig | null }>();

// Run `fn` (and everything it awaits) with a resolved per-tenant SendSeven
// config. Pass null when the org has no token → falls through to the env token.
export function runWithSendSevenConfig(config: SendSevenConfig | null, fn: () => void): void {
  tenantContext.run({ config }, fn);
}

function envConfig(): SendSevenConfig | null {
  const baseUrl = process.env.CONVERSATIONS_API_URL;
  const token = process.env.CONVERSATIONS_API_TOKEN;
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

// The org's token wins; otherwise the global env token (or null).
function config(): SendSevenConfig | null {
  return tenantContext.getStore()?.config ?? envConfig();
}

export const isSendSevenConfigured = (): boolean => config() !== null;

// Serve fixture data only when nothing is configured AND fixtures aren't disabled.
export const useSampleData = (): boolean =>
  !isSendSevenConfigured() && process.env.CONVERSATIONS_DISABLE_FIXTURES !== "true";

let warned = false;
export function warnSendSevenOnce(): void {
  if (!warned) {
    console.warn("[sendseven] CONVERSATIONS_API_URL/TOKEN not set — serving temporary sample data where possible.");
    warned = true;
  }
}

// `path` is relative to the base URL, e.g. "/conversations" or "/messages".
export async function sendSevenRequest<T>(
  method: string,
  path: string,
  opts: { query?: SsQuery; body?: unknown } = {},
): Promise<T> {
  const cfg = config();
  if (!cfg) {
    warnSendSevenOnce();
    throw new AppError("SendSeven API is not configured (set CONVERSATIONS_API_URL and CONVERSATIONS_API_TOKEN)", 503);
  }

  const url = new URL(`${cfg.baseUrl}${path}`);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  let res: globalThis.Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new AppError("Failed to reach the SendSeven service", 502);
  }

  if (!res.ok) {
    let message = `SendSeven service returned ${res.status}`;
    try {
      const err = (await res.json()) as { detail?: unknown; message?: unknown };
      const detail = err?.detail ?? err?.message;
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        // FastAPI validation errors: [{ loc: [...], msg, type }]
        const parts = detail
          .map((d) => {
            const item = d as { loc?: unknown[]; msg?: string };
            const field = Array.isArray(item.loc) ? item.loc.filter((l) => l !== "body").join(".") : "";
            return field ? `${field}: ${item.msg}` : item.msg;
          })
          .filter(Boolean);
        if (parts.length) message = parts.join("; ");
      }
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw new AppError(message, status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
