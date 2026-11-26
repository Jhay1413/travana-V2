/**
 * A loopback HTTP server that stands in for the two message providers, so a spec can prove "exactly one WhatsApp
 * template send to +44..., zero SMS" without anything leaving this machine:
 *
 *  - Connexa (SMS):  POST /connexa/api/issue-token, POST /connexa/api/schedule-message
 *  - SendSeven (WhatsApp, the workspace API):
 *      GET  /sendseven/channels, /channels/types, /channels/health
 *      GET  /sendseven/whatsapp-templates
 *      POST /sendseven/whatsapp-templates/:name/send        (a template send)
 *      POST /sendseven/conversations/check-existing         (is there an open chat / is the 24h window open)
 *      POST /sendseven/messages                             (a plain text message)
 *
 * Every call is recorded. The suite starts it once (global-setup.ts) and the test server is pointed at it through
 * CONNEXA_BASE_URL (env.ts). SendSeven is reached through a per-agency integration row whose base_url is
 * `${FAKE_PROVIDERS_URL}/sendseven` (see helpers/messaging.ts), so it is only used by agencies that a spec sets up.
 *
 * Specs talk to it over HTTP (they run in worker processes), through the `fakeProviders` client below.
 * Connexa answers 401 until a spec arms it, so an existing spec that triggers an SMS still ends in a failed row.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { FAKE_PROVIDERS_PORT, FAKE_PROVIDERS_URL } from "./env";
import { FAKE_CONNEXA_EMAIL, FAKE_CONNEXA_PASSWORD } from "./safety-guard";

export { FAKE_CONNEXA_EMAIL, FAKE_CONNEXA_PASSWORD, FAKE_PROVIDERS_PORT, FAKE_PROVIDERS_URL };
/** The SendSeven token written (encrypted) into a spec's integration row. */
export const FAKE_SENDSEVEN_TOKEN = "e2e-fake-sendseven-token";

export interface RecordedCall {
  seq: number;
  provider: "connexa" | "sendseven";
  method: string;
  /** Path below the provider prefix, e.g. "/api/schedule-message" or "/whatsapp-templates/booking_ok/send". */
  path: string;
  query: Record<string, string>;
  body: unknown;
  /** The Bearer token the caller presented. */
  token: string | null;
}

export interface FakeChannel {
  id: string;
  channel_type: string;
  name?: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface FakeTemplate {
  id: string;
  channel_id: string;
  name: string;
  language: string;
  category: string;
  header_type: string | null;
  header_text: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: null;
  status: string;
  quality_score: null;
  parameter_format: "positional";
  last_synced_at: null;
  created_at: string;
  updated_at: string;
}

export interface FakeConfig {
  /** Connexa accepts logins and messages only while armed. */
  connexaArmed: boolean;
  /** The channels SendSeven lists. */
  channels: FakeChannel[];
  /** The approved templates SendSeven lists. */
  templates: FakeTemplate[];
  /** A template send answers success:false. */
  templateSendFails: boolean;
  /** A template send answers an HTTP error. */
  templateSendErrors: boolean;
}

export const FAKE_WHATSAPP_CHANNEL: FakeChannel = { id: "fake-wa-channel", channel_type: "whatsapp", name: "E2E WhatsApp", is_active: true, is_verified: true };

export function fakeTemplate(name: string, bodyText: string, over: Partial<FakeTemplate> = {}): FakeTemplate {
  return {
    id: `tpl-${name}`,
    channel_id: FAKE_WHATSAPP_CHANNEL.id,
    name,
    language: "en_GB",
    category: "UTILITY",
    header_type: null,
    header_text: null,
    body_text: bodyText,
    footer_text: null,
    buttons: null,
    status: "APPROVED",
    quality_score: null,
    parameter_format: "positional",
    last_synced_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function defaultConfig(): FakeConfig {
  return {
    connexaArmed: false,
    channels: [FAKE_WHATSAPP_CHANNEL],
    templates: [
      fakeTemplate("booking_confirmed", "Hi {{1}}, your booking to {{2}} is confirmed."),
      fakeTemplate("portal_ready_msg", "Hi {{1}}, your portal is ready: {{2}}"),
      fakeTemplate("balance_reminder_msg", "Hi {{1}}, your balance for {{2}} is due on {{3}}."),
      fakeTemplate("departure_reminder_msg", "Hi {{1}}, you fly to {{2}} on {{3}}. Booking {{4}}."),
    ],
    templateSendFails: false,
    templateSendErrors: false,
  };
}

/** Pure request handler state, so it is unit-testable without a socket. */
export function createFakeProvidersState() {
  let config = defaultConfig();
  let calls: RecordedCall[] = [];
  let seq = 0;
  return {
    config: () => config,
    calls: () => calls,
    reset(): void {
      config = defaultConfig();
      calls = [];
      seq = 0;
    },
    configure(patch: Partial<FakeConfig>): void {
      config = { ...config, ...patch };
    },
    record(call: Omit<RecordedCall, "seq">): number {
      seq += 1;
      calls.push({ ...call, seq });
      return seq;
    },
  };
}
export type FakeProvidersState = ReturnType<typeof createFakeProvidersState>;

type Reply = { status: number; body: unknown };
const ok = (body: unknown): Reply => ({ status: 200, body });

/** Answers one request. Exported for the unit test. */
export function answer(state: FakeProvidersState, call: Omit<RecordedCall, "seq">): Reply {
  const cfg = state.config();
  const n = state.record(call);

  if (call.provider === "connexa") {
    if (!cfg.connexaArmed) return { status: 401, body: { error: "fake provider is not armed" } };
    // expires_in of 1 second: the server only caches a token that outlives its 30 second refresh lead, so every send
    // asks for a fresh one (a spec can count exactly one token request per attempt, whatever ran before it).
    if (call.path === "/api/issue-token") return ok({ access_token: "fake-connexa-token", expires_in: 1 });
    if (call.path === "/api/schedule-message") return ok({ response: { status: "accepted", data: { uuid: `fake-sms-${n}` } } });
    return { status: 404, body: { error: "unknown connexa path" } };
  }

  if (call.method === "GET" && call.path === "/channels") return ok(cfg.channels);
  if (call.method === "GET" && call.path === "/channels/types") {
    return ok({ available: ["whatsapp"], coming_soon: [], all_types: [{ value: "whatsapp", display_name: "WhatsApp", is_available: true }] });
  }
  if (call.method === "GET" && call.path === "/channels/health") return ok({ has_errors: false, error_count: 0, integrations: [] });
  if (call.method === "GET" && call.path === "/whatsapp-templates") {
    const channelId = call.query.channel_id;
    const templates = cfg.templates.filter((t) => !channelId || t.channel_id === channelId);
    return ok({ templates, total: templates.length });
  }
  const send = /^\/whatsapp-templates\/([^/]+)\/send$/.exec(call.path);
  if (call.method === "POST" && send) {
    if (cfg.templateSendErrors) return { status: 500, body: { detail: "fake provider error" } };
    if (cfg.templateSendFails) {
      return ok({ success: false, message_id: null, external_id: null, conversation_id: "", error: "rejected", error_code: 131000, error_details: "fake provider rejected the template" });
    }
    return ok({ success: true, message_id: `fake-wa-${n}`, external_id: `wamid.fake${n}`, conversation_id: `fake-conv-${n}`, error: null, error_code: null, error_details: null });
  }
  if (call.method === "POST" && call.path === "/conversations/check-existing") return ok({ has_existing_open: false, existing_open_conversation_id: null, requires_template: true });
  if (call.method === "POST" && call.path === "/messages") return ok({ id: `fake-msg-${n}`, status: "sent", error_message: null });
  return { status: 404, body: { detail: `unknown fake sendseven path ${call.method} ${call.path}` } };
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolve(null);
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(text);
      }
    });
  });
}

function send(res: ServerResponse, reply: Reply): void {
  res.writeHead(reply.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(reply.body));
}

export interface RunningFakeProviders {
  url: string;
  state: FakeProvidersState;
  close: () => Promise<void>;
}

/** Starts the server on 127.0.0.1 only. Throws if the port is taken (a leftover run). */
export async function startFakeProviders(port: number = FAKE_PROVIDERS_PORT): Promise<RunningFakeProviders> {
  const state = createFakeProvidersState();
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const body = await readBody(req);

    // Control surface for specs; never recorded.
    if (url.pathname === "/__control/calls" && req.method === "GET") return send(res, ok(state.calls()));
    if (url.pathname === "/__control/reset" && req.method === "POST") {
      state.reset();
      return send(res, ok({ ok: true }));
    }
    if (url.pathname === "/__control/config" && req.method === "POST") {
      state.configure((body ?? {}) as Partial<FakeConfig>);
      return send(res, ok(state.config()));
    }

    const m = /^\/(connexa|sendseven)(\/.*)$/.exec(url.pathname);
    if (!m) return send(res, { status: 404, body: { error: "unknown path" } });
    const auth = req.headers.authorization;
    send(
      res,
      answer(state, {
        provider: m[1] as "connexa" | "sendseven",
        method: req.method ?? "GET",
        path: m[2],
        query: Object.fromEntries(url.searchParams.entries()),
        body,
        token: typeof auth === "string" ? auth.replace(/^Bearer\s+/i, "") : null,
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  const actual = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${actual}`,
    state,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// ── The client specs use (they run in other processes than the server that hosts the fake) ──

async function control<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${FAKE_PROVIDERS_URL}/__control${path}`, init);
  if (!res.ok) throw new Error(`fake providers ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export interface TemplateSend {
  templateName: string;
  body: { whatsapp_id?: string; contact_id?: string; conversation_id?: string | null; channel_id?: string; language?: string | null; variable_values?: Record<string, string> };
}

export const fakeProviders = {
  /** Forget every call and put the configuration back to its default (disarmed Connexa, one WhatsApp channel, four templates). */
  reset: () => control<{ ok: true }>("/reset", { method: "POST" }),
  configure: (patch: Partial<FakeConfig>) =>
    control<FakeConfig>("/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }),
  /** Connexa accepts logins and messages (an SMS can now be "sent" to the fake). */
  armConnexa: () => fakeProviders.configure({ connexaArmed: true }),
  calls: () => control<RecordedCall[]>("/calls"),
  /** The SMS actually accepted by the fake provider. */
  async sms(): Promise<{ to: string; message: string }[]> {
    return (await fakeProviders.calls())
      .filter((c) => c.provider === "connexa" && c.path === "/api/schedule-message")
      .map((c) => {
        const b = c.body as { contact_number: string; message: string };
        return { to: b.contact_number, message: b.message };
      });
  },
  /** Every WhatsApp template send the fake received. */
  async templateSends(): Promise<TemplateSend[]> {
    return (await fakeProviders.calls())
      .map((c) => ({ c, m: /^\/whatsapp-templates\/([^/]+)\/send$/.exec(c.path) }))
      .filter((x) => x.c.provider === "sendseven" && x.c.method === "POST" && x.m)
      .map((x) => ({ templateName: decodeURIComponent((x.m as RegExpExecArray)[1]), body: x.c.body as TemplateSend["body"] }));
  },
  /** Every plain WhatsApp text message the fake received. */
  async textMessages(): Promise<unknown[]> {
    return (await fakeProviders.calls()).filter((c) => c.provider === "sendseven" && c.method === "POST" && c.path === "/messages").map((c) => c.body);
  },
};
