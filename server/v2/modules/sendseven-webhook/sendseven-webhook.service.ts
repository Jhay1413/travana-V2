import crypto from "node:crypto";
import { decrypt, encrypt } from "../../utils/encryption";
import { AppError } from "../../utils/error-handler";
import { getPublicBaseUrl } from "../../utils/public-url";
import { runWithSendSevenConfigAsync, sendSevenRequest, type SendSevenConfig } from "../../utils/sendseven";
import { conversationIntegrationRepository } from "../conversation-integration/conversation-integration.repository";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { realtimeService } from "../../realtime/realtime.service";
import { neonClientService } from "../neon-client/neon-client.service";
import { conversationStateRepository } from "./conversation-state.repository";
import { systemScope } from "./identity.service";
import { replyWorker } from "./reply-worker.service";
import { sendsevenWebhookRepository } from "./sendseven-webhook.repository";
import type { ConversationAiState, SsWebhookEndpointCreated, SsWebhookEvent } from "./sendseven-webhook.types";
import type { SendsevenConversationState } from "@shared/schema";

// The SendSeven connection to register the webhook against: the org's resolved
// config (managed sub-account via parent token + X-Tenant-ID, or a manual token),
// else the global env fallback. sendSevenRequest sends X-Tenant-ID automatically
// when the config carries a tenantId.
async function effectiveConfig(orgId: string): Promise<SendSevenConfig | null> {
  const cfg = await conversationIntegrationService.resolveConfig(orgId);
  if (cfg) return cfg;
  const baseUrl = process.env.CONVERSATIONS_API_URL;
  const token = process.env.CONVERSATIONS_API_TOKEN;
  if (baseUrl && token) return { baseUrl: baseUrl.replace(/\/$/, ""), token };
  return null;
}

// Deletes EVERY SendSeven webhook endpoint pointing at this org's receiver —
// clears out stale/orphaned endpoints (e.g. from failed enable attempts) so only
// the one we track remains. Best-effort.
async function pruneEndpoints(cfg: SendSevenConfig, orgId: string): Promise<number> {
  const suffix = `/api/v2/sendseven-webhook/${orgId}`;
  const list = await runWithSendSevenConfigAsync(cfg, () =>
    sendSevenRequest<Array<{ id?: string; url?: string }>>("GET", "/webhook-endpoints"),
  ).catch(() => [] as Array<{ id?: string; url?: string }>);
  const targets = (Array.isArray(list) ? list : []).filter((ep) => ep.id && (ep.url ?? "").includes(suffix));
  for (const ep of targets) {
    await runWithSendSevenConfigAsync(cfg, () => sendSevenRequest("DELETE", `/webhook-endpoints/${ep.id}`)).catch((e) =>
      console.error(`[sendseven-webhook] delete ${ep.id} failed:`, e instanceof Error ? e.message : e),
    );
  }
  return targets.length;
}

// Maps a (possibly absent) state row + the linked client's opt-in flag to the
// AI-state API shape. DEFAULT-OFF model: with no row (or no override and no
// opted-in client) the AI is NOT active — the bot only replies where an agent
// opted in, per-conversation or per-client. needsHuman still pauses an
// otherwise-active conversation (human takeover).
function toAiState(row: SendsevenConversationState | null, clientAiEnabled: boolean): ConversationAiState {
  const override = (row?.aiOverride ?? null) as "enabled" | "disabled" | null;
  const optedIn = override === "enabled" || (override !== "disabled" && clientAiEnabled);
  return {
    aiActive: optedIn && !row?.needsHuman,
    needsHuman: !!row?.needsHuman,
    handledByHumanAt: row?.handledByHumanAt ? row.handledByHumanAt.toISOString() : null,
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    source: override ? "override" : clientAiEnabled ? "client" : "default",
    clientAiEnabled,
  };
}

// Best-effort real-time publish — a bus failure must NEVER break the webhook
// ack, a staff send, or an AI reply, so every call site wraps this in a
// try/catch that only warns.
function publishRealtime(orgId: string, event: Parameters<typeof realtimeService.publish>[1]): void {
  try {
    realtimeService.publish(orgId, event);
  } catch (err) {
    console.warn(`[sendseven-webhook] realtime publish failed org=${orgId} type=${event.type}:`, err);
  }
}

const SUBSCRIBED_EVENTS = ["message.received", "message.sent", "conversation.updated"];
const MAX_SKEW_SECONDS = 300;

// Verifies X-Sendseven-Signature over `${timestamp}.${rawBody}` (HMAC-SHA256),
// with a 5-minute replay window and a timing-safe comparison. Returns detail so
// the caller can log *why* a delivery failed (HMAC mismatch vs stale timestamp).
function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  timestamp: string | undefined,
  secret: string,
): { ok: boolean; reason: string; skew: number | null; hmacMatched: boolean } {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return { ok: false, reason: signatureHeader ? "bad-signature-format" : "missing-signature-header", skew: null, hmacMatched: false };
  }
  if (!timestamp) return { ok: false, reason: "missing-timestamp-header", skew: null, hmacMatched: false };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad-timestamp", skew: null, hmacMatched: false };
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);

  const message = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]);
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  const hmacMatched = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!hmacMatched) return { ok: false, reason: "hmac-mismatch", skew, hmacMatched };
  if (skew > MAX_SKEW_SECONDS) return { ok: false, reason: "timestamp-too-old", skew, hmacMatched };
  return { ok: true, reason: "ok", skew, hmacMatched };
}

export const sendsevenWebhookService = {
  // Registers the org's webhook endpoint. Requires a provisioned sub-account
  // (tenantId) and a public HTTPS base URL.
  //
  // Connecting the webhook is INDEPENDENT of the AI: it's what powers the
  // realtime inbox (SSE toasts + cache invalidation) and human-takeover
  // detection. `autoReply` decides whether the bot also answers — pass false to
  // get live updates with the AI silent. Omit it to leave the flag as-is (a
  // re-register must not silently switch the bot on).
  async connectWebhook(
    orgId: string,
    opts: { name?: string; mode?: string; autoReply?: boolean } = {},
  ): Promise<{ endpointId: string; url: string }> {
    const cfg = await effectiveConfig(orgId);
    if (!cfg) {
      throw new AppError("Connect this org's SendSeven workspace before enabling the bot (no tenant, token, or env fallback).", 400);
    }

    const base = (getPublicBaseUrl() || "").replace(/\/$/, "");
    if (!base.startsWith("https://")) {
      throw new AppError("A public HTTPS base URL is required for webhooks (set PUBLIC_BASE_URL)", 400);
    }
    const url = `${base}/api/v2/sendseven-webhook/${orgId}`;

    // Clean up any prior/orphaned endpoints for this org so we end up with one.
    await pruneEndpoints(cfg, orgId).catch(() => undefined);

    // Registers on whichever SendSeven workspace the org's inbox uses (X-Tenant-ID
    // applied automatically when cfg.tenantId is set).
    const created = await runWithSendSevenConfigAsync(cfg, () =>
      sendSevenRequest<SsWebhookEndpointCreated>("POST", "/webhook-endpoints", {
        body: { name: opts.name ?? "Travana AI auto-reply", url, subscribed_events: SUBSCRIBED_EVENTS },
      }),
    );

    // Persist — and if storing fails (e.g. missing EMAIL_ENCRYPTION_KEY), roll the
    // just-created endpoint back so we never leave an orphan pointing at us.
    try {
      await conversationIntegrationRepository.setWebhook(orgId, {
        webhookEndpointId: created.webhook_id,
        webhookSecret: encrypt(created.secret_key),
        autoReplyMode: opts.mode,
        autoReplyEnabled: opts.autoReply,
      });
    } catch (err) {
      await runWithSendSevenConfigAsync(cfg, () =>
        sendSevenRequest("DELETE", `/webhook-endpoints/${created.webhook_id}`),
      ).catch(() => undefined);
      throw err;
    }
    console.log(
      `[sendseven-webhook] Registered endpoint ${created.webhook_id} for org ${orgId} → ${url}` +
        (opts.autoReply === undefined ? "" : ` (auto-reply ${opts.autoReply ? "on" : "off"})`),
    );
    return { endpointId: created.webhook_id, url };
  },

  // Deletes the org's webhook endpoint and clears our side (which also disables
  // auto-reply — no deliveries, nothing to reply to). Endpoint deletion is
  // best-effort. This STOPS realtime inbox updates too; to silence only the bot,
  // use setAutoReply(orgId, false) instead.
  async disconnectWebhook(orgId: string): Promise<void> {
    const cfg = await effectiveConfig(orgId);
    if (cfg) {
      const removed = await pruneEndpoints(cfg, orgId).catch(() => 0);
      console.log(`[sendseven-webhook] Removed ${removed} webhook endpoint(s) for org ${orgId}`);
    }
    await conversationIntegrationRepository.clearWebhook(orgId);
  },

  // Turns the AI bot on/off without touching the webhook registration, so the
  // inbox keeps updating live either way. Enabling registers the endpoint first
  // when it isn't connected yet — an enabled bot with no deliveries would be a
  // silent no-op.
  async setAutoReply(orgId: string, enabled: boolean, opts: { mode?: string } = {}): Promise<void> {
    const integration = await conversationIntegrationRepository.findByOrg(orgId);
    if (enabled && !integration?.webhookSecret) {
      await this.connectWebhook(orgId, { mode: opts.mode, autoReply: true });
      return;
    }
    if (opts.mode) await conversationIntegrationRepository.setAutoReplyMode(orgId, opts.mode);
    await conversationIntegrationRepository.setAutoReplyEnabled(orgId, enabled);
  },

  // Verifies + records a delivery (fast, synchronous work only). Returns the
  // parsed event to process, or null when it's a duplicate retry. Throws
  // AppError on bad/unauthenticated deliveries so the receiver returns the right
  // status. The caller acks 200 THEN runs `process` (AI can exceed the 30s cap).
  async receive(
    orgId: string,
    rawBody: Buffer | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
  ): Promise<SsWebhookEvent | null> {
    if (!rawBody || rawBody.length === 0) throw new AppError("Empty webhook body", 400);

    // Gated on the webhook registration alone, NOT on autoReplyEnabled: a
    // connected webhook feeds the realtime inbox regardless of whether the bot
    // is answering. Whether the AI runs is decided later, in process().
    const integration = await conversationIntegrationRepository.findByOrg(orgId);
    if (!integration?.webhookSecret) {
      throw new AppError("Webhook not connected for this organisation", 404);
    }

    let secret: string;
    try {
      secret = decrypt(integration.webhookSecret);
    } catch {
      throw new AppError("Webhook secret unreadable", 500);
    }
    const verdict = verifySignature(rawBody, signature, timestamp, secret);
    if (!verdict.ok) {
      // Diagnostic: hmac-mismatch = wrong/stale secret (e.g. an orphan endpoint);
      // timestamp-too-old = a stale retry (signature was actually valid).
      console.warn(
        `[sendseven-webhook] signature rejected org=${orgId} reason=${verdict.reason} ` +
          `hmacMatched=${verdict.hmacMatched} skew=${verdict.skew}s bodyLen=${rawBody.length}`,
      );
      // A stale-but-authentic retry isn't an attack — ack it so SendSeven stops
      // retrying and doesn't circuit-break the endpoint.
      if (verdict.reason === "timestamp-too-old") return null;
      throw new AppError("Invalid webhook signature", 401);
    }

    let event: SsWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString("utf8")) as SsWebhookEvent;
    } catch {
      throw new AppError("Invalid webhook JSON", 400);
    }

    const eventId = event.event_id || event.id;
    if (!eventId) throw new AppError("Missing event id", 400);

    const isNew = await sendsevenWebhookRepository.recordEvent({
      eventId,
      orgId,
      messageId: event.data?.message?.id ?? null,
      type: event.type ?? null,
    });
    return isNew ? event : null; // duplicate retry → nothing to process
  },

  // Async processing (after the 200 ack). Routes by event type: human takeover
  // detection vs. an inbound customer message the AI should reply to (§6, §8).
  //
  // Every branch publishes its realtime event unconditionally — those drive the
  // inbox regardless of the bot. Only the AI-specific work (hand-off bookkeeping
  // and the reply itself) is gated on autoReplyEnabled, which is what lets an org
  // run a live inbox with the bot switched off.
  async process(orgId: string, event: SsWebhookEvent): Promise<void> {
    const m = event.data?.message;
    const conversationId = m?.conversation_id;
    const integration = await conversationIntegrationRepository.findByOrg(orgId);
    const aiEnabled = !!integration?.autoReplyEnabled;

    // A human agent replied (outbound and NOT one of ours) → they own it now.
    if (event.type === "message.sent" && m?.direction === "outbound") {
      const metaOurs = (m.meta as { source?: string } | null | undefined)?.source === "travana-ai";
      const ours = metaOurs || (m.id ? await sendsevenWebhookRepository.isOurMessage(m.id) : false);
      if (!ours && conversationId) {
        publishRealtime(orgId, { type: "message.sent", conversationId });
        // Hand-off state only matters to the bot; with it off, skip the writes
        // rather than accumulating needsHuman rows nothing will ever read.
        if (aiEnabled) {
          console.log(`[sendseven-webhook] human reply detected on conv ${conversationId} → handing off to human`);
          await conversationStateRepository.ensure(conversationId, orgId, m.contact_id ?? null);
          await conversationStateRepository.setNeedsHuman(conversationId, undefined, "human_reply");
          publishRealtime(orgId, { type: "ai-state.changed", conversationId, needsHuman: true });
        }
      }
      return;
    }

    // Conversation assigned to a human agent → hand off.
    if (event.type === "conversation.updated") {
      const conv = event.data?.conversation as { id?: string; assigned_user?: unknown; assigned_user_id?: unknown } | undefined;
      const assigned = conv?.assigned_user ?? conv?.assigned_user_id;
      if (aiEnabled && assigned && conv?.id) {
        await conversationStateRepository.ensure(conv.id, orgId, null);
        await conversationStateRepository.setNeedsHuman(conv.id, undefined, "human_reply");
        publishRealtime(orgId, { type: "ai-state.changed", conversationId: conv.id, needsHuman: true });
      }
      if (conv?.id) publishRealtime(orgId, { type: "conversation.updated", conversationId: conv.id });
      return;
    }

    // Inbound customer message → notify the inbox, and let the AI reply if it's on.
    if (event.type === "message.received" && m?.direction === "inbound") {
      if (conversationId) publishRealtime(orgId, { type: "message.received", conversationId });
      if (aiEnabled) await replyWorker.handleInbound(orgId, event);
    }
  },

  // ── Per-conversation AI enable/disable/status (conversations module) ──

  async getAiState(orgId: string, conversationId: string): Promise<ConversationAiState> {
    const row = await conversationStateRepository.getState(conversationId, orgId);
    return toAiState(row, await this.clientAiEnabled(orgId, row));
  },

  // The linked client's own AI opt-in flag — false when the conversation has
  // no linked client (or the lookup fails). Kept private-ish (used by
  // getAiState); the reply worker does its own equivalent check inline.
  async clientAiEnabled(orgId: string, row: SendsevenConversationState | null): Promise<boolean> {
    if (!row?.clientId) return false;
    const client = await neonClientService.getNeonClientById(row.clientId, systemScope(orgId)).catch(() => null);
    return !!client?.aiReplyEnabled;
  },

  // Manual enable: an explicit per-conversation override — the AI replies
  // here even if the linked client isn't opted in (or no client is linked
  // yet). Also clean-slate clears any hand-off state (see
  // conversationStateRepository.clearNeedsHuman).
  async enableAi(orgId: string, conversationId: string): Promise<ConversationAiState> {
    await conversationStateRepository.ensure(conversationId, orgId, null);
    await conversationStateRepository.clearNeedsHuman(conversationId, orgId);
    await conversationStateRepository.setAiOverride(conversationId, orgId, "enabled");
    publishRealtime(orgId, { type: "ai-state.changed", conversationId, needsHuman: false });
    return this.getAiState(orgId, conversationId);
  },

  // Manual disable: an explicit per-conversation override — the AI never
  // replies here even if the linked client IS opted in. needsHuman is set too
  // so in-flight state is cleared exactly like the old pause.
  async disableAi(orgId: string, conversationId: string): Promise<ConversationAiState> {
    await conversationStateRepository.ensure(conversationId, orgId, null);
    await conversationStateRepository.setNeedsHuman(conversationId, orgId);
    await conversationStateRepository.setAiOverride(conversationId, orgId, "disabled");
    publishRealtime(orgId, { type: "ai-state.changed", conversationId, needsHuman: true });
    return this.getAiState(orgId, conversationId);
  },

  // Synchronous AI pause for a staff reply sent from our inbox (messages
  // module's send path) — so the AI goes silent immediately rather than
  // waiting on the message.sent webhook echo (process(), above), which
  // remains the backstop for replies sent directly in SendSeven. Best-effort:
  // the caller wraps this in try/catch so a state-write failure never blocks
  // sending the actual message.
  async pauseAiForStaffReply(orgId: string, conversationId: string): Promise<void> {
    await conversationStateRepository.ensure(conversationId, orgId, null);
    await conversationStateRepository.setNeedsHuman(conversationId, orgId, "human_reply");
    publishRealtime(orgId, { type: "ai-state.changed", conversationId, needsHuman: true });
  },
};
