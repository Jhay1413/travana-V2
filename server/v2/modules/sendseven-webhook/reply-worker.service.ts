import { runWithSendSevenConfigAsync } from "../../utils/sendseven";
import { realtimeService } from "../../realtime/realtime.service";
import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import {
  buildEnquirySummary,
  buildPhoneConflictReply,
  buildTranscript,
  decideDeterministicRoute,
  effectiveAttachmentKind,
  generateDocumentReceivedAsk,
  triageImageAttachments,
  generateBeneficiaryAsk,
  generateGeneralReply,
  generateTransitionReply,
  generateTurn,
  hasSubstantiveSignal,
  inferHolidayTypeFromText,
  isAcknowledgement,
  kbExceedsBudget,
  looksLikeActionableAdmin,
  looksLikeAdminAsk,
  mergeSlots,
  missingCoreFieldsFor,
  missingFieldsFor,
  parseAvailabilityTime,
  shouldCreateEnquiryNow,
  shouldForceTicketNow,
  similarReply,
  type BeneficiaryAskKind,
} from "../ai-conversation/ai-conversation.brain";
import { classifyConversationRoute } from "../ai-conversation/conversation-router";
import { botConfigRepository } from "../bot-config/bot-config.repository";
import { conversationIntegrationRepository } from "../conversation-integration/conversation-integration.repository";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { knowledgeBaseRepository } from "../knowledge-base/knowledge-base.repository";
import { messagesRepository } from "../messages/messages.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { conversationStateRepository } from "./conversation-state.repository";
import { sendsevenWebhookRepository } from "./sendseven-webhook.repository";
import { resolveAndCreateEnquiry } from "./enquiry-auto-create.service";
import {
  createNewClientAndLink,
  extractPhoneNumber,
  insertClient,
  resolveClientForOnboarding,
  resolveExistingClient,
  resolveOrCreateByDetails,
  samePhoneNumber,
  systemScope,
} from "./identity.service";
import { taskService } from "../task/task.service";
import { usageService } from "../usage/usage.service";
import { adminAgent } from "./admin-agent.service";
import type { PendingAttachment } from "./admin-data.service";
import type { AiTurn, EnquirySlots, RetrievedContext, RetrievedMatch } from "../ai-conversation/ai-conversation.types";
import type { HandoffReason, SsWebhookEvent } from "./sendseven-webhook.types";
import type { SendsevenConversationState } from "@shared/schema";

// Transient flags/context we keep on `sendseven_conversation_state.context`
// (jsonb) across the collecting → create → awaiting-availability → scheduled
// flow. No schema columns needed.
interface ConversationContext {
  lastReply?: string;
  // Why this conversation was handed off (needsHuman=true) — written by every
  // hand-off site (setNeedsHuman + the direct update() writes below). The
  // resume gate in handleInbound reads it: human-owned reasons make the
  // hand-off sticky (silent until an agent re-enables the AI from the inbox);
  // AI-caused reasons allow the idle auto-resume. Absent on rows written
  // before this existed → treated as "human_reply" (fail safe: stay silent).
  handoffReason?: HandoffReason;
  // LEGACY: was set once we'd sent the ONE grouped follow-up for whatever
  // enquiry fields were still missing (the customer's next reply would then
  // create the enquiry). No longer SET by this driver — the enquiry is now
  // created immediately, on the same turn the core fields complete — but
  // still READ, so a conversation that started under the old flow (this flag
  // already true from a prior turn) is still treated as ready-to-create. See
  // shouldCreateEnquiryNow.
  groupedAskSent?: boolean;
  // Number of collecting-phase questions asked so far this enquiry (the
  // collecting-thin and collecting-continue branches). Gates the
  // required-core-fields wait: once the ask-cap (MAX_ENQUIRY_ASKS) is hit, the
  // enquiry is created regardless of what core fields are still missing, so a
  // customer who declines/gives vague answers is never interrogated forever.
  // Reset implicitly on enquiry creation — the new context object built there
  // omits it.
  askCount?: number;
  // The org user the just-created enquiry is owned by — reused as the
  // assignee of the callback task at the awaiting_availability step.
  enquiryOwnerUserId?: string;
  // For a third-party enquiry: the traveller's name, carried to the
  // awaiting_availability step so the callback confirmation refers to them.
  onBehalfOfName?: string;
  // Guards against double-creating the callback task if the inbound is
  // reprocessed while still in awaiting_availability.
  availabilityTaskId?: string;
  // Which bot last handled this conversation ("sales" | "admin") — used to
  // stick a multi-turn admin exchange (e.g. "which quote?" / "the Corfu one")
  // to the admin bot rather than flip-flopping on an ambiguous follow-up.
  domain?: "sales" | "admin";
  // True once the admin bot has opened a support ticket for this conversation —
  // stops it opening duplicates on later turns.
  ticketOpened?: boolean;
  // True once the admin bot has already asked the customer for detail (a prior
  // admin turn ran without opening a ticket) — used to force a ticket on the next
  // actionable turn instead of re-asking.
  adminAsked?: boolean;
  // True once this conversation is a known ACTIONABLE admin matter (a complaint /
  // document / details submission) that needs a ticket — gates the force so a
  // read-only admin Q&A never gets a ticket forced on it.
  adminActionable?: boolean;
  // Set during onboarding when the phone number the customer gave is already on
  // file under a DIFFERENT client's name — we've asked them to confirm it. Holds
  // the number in question so the next turn can tell a correction (new number)
  // from a confirmation (same number again).
  phoneConflictPhone?: string;
  // Accumulated details read (vision triage) from holiday_info image(s) the
  // customer sent — persisted so they stay in the AI's view on EVERY
  // collecting turn, not just the turn the image arrived (a field the model
  // doesn't extract into slots immediately would otherwise be lost for good).
  // Cleared automatically when the enquiry is created / the conversation
  // hands off or resets (those paths build fresh contexts).
  holidayImageInfo?: string;
  // Attachment refs (id + metadata, NEVER bytes) from message(s) sent BEFORE
  // onboarding completed. A file can only be ACTIONED once the sender is
  // identified (the admin bot needs a client to ticket against; a holiday
  // enquiry needs a client to file under) — so a passport photo or deal
  // screenshot sent as the opening message would otherwise be lost by the
  // time the customer's next message completes onboarding. The onboarding
  // gate stashes the refs here — `kind`/`description` carry that turn's
  // vision triage so the consume turn can route (document → admin/ticket,
  // holiday_info → sales with the details re-injected) without re-running
  // vision. The first post-onboarding turn consumes + clears this. Wiped
  // with the rest of the context by the needsHuman/idle-resume resets, so it
  // can never linger across a hand-off.
  pendingAttachmentRefs?: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    kind?: "document" | "holiday_info" | "other";
    description?: string;
  }>;
  // Set when the customer is enquiring on behalf of a named third party — the
  // enquiry is filed under this traveller, not the sender. Persisted across turns
  // so we keep asking for/resolving the traveller (and don't re-ask their name).
  beneficiary?: {
    // The traveller's name — may be absent at first ("my friend wants…") until
    // we ask for it.
    name?: string;
    phone?: string;
    // The resolved/created client id for the traveller (once we have their phone).
    clientId?: string;
    // Mirrors phoneConflictPhone but for the traveller's number clash.
    phoneConflictPhone?: string;
  };
}

// Tag our outbound so the message.sent webhook can tell it from a human agent's
// reply (§8). Human replies (untagged) trigger the hand-off.
const AI_META = { source: "travana-ai" };
const HISTORY_LIMIT = 20;
// AI re-engages after this much inactivity — but ONLY on AI-caused hand-offs
// ("ai_wound_down" / "enquiry_scheduled"). A hand-off caused by a real human
// (agent replied, conversation assigned, manual disable) is sticky and never
// auto-resumes — an agent re-enables the AI from the inbox. 7 days so the
// auto-resume only fires on genuinely abandoned threads, not mid-deal lulls.
const RESUME_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_REPLY = "Thanks for your message — one of our advisors will be in touch shortly.";
// Inbound message_types that carry a file even when there's no text caption — so
// a bare passport photo isn't dropped by the text-only gate.
const MEDIA_MESSAGE_TYPES = new Set(["image", "document", "file", "video", "audio", "voice", "sticker"]);

export const replyWorker = {
  // Handles one inbound customer message: identity resolution → AI turn → enquiry
  // slot-filling / reply (draft or send). Assumes the delivery is verified and the
  // org has auto-reply on.
  async handleInbound(orgId: string, event: SsWebhookEvent): Promise<void> {
    const message = event.data?.message;
    const contact = event.data?.contact as { id?: string; name?: string; phone?: string; email?: string } | undefined;
    const conversationId = message?.conversation_id;
    if (!conversationId || !message) return;
    if (message.direction !== "inbound") return;
    // Process the message if it has text OR is a media message (which may arrive
    // with no caption — e.g. a passport photo). Non-media empty messages are
    // still ignored.
    const hasText = !!message.text?.trim();
    const isMediaMessage = MEDIA_MESSAGE_TYPES.has((message.message_type ?? "").toLowerCase());
    if (!hasText && !isMediaMessage) return;

    const contactId = message.contact_id ?? contact?.id ?? null;

    // Inactivity is measured from the LAST time we touched the conversation, taken
    // BEFORE ensure() bumps updatedAt for this message.
    const prior = await conversationStateRepository.find(conversationId);
    const inactiveMs = prior?.updatedAt ? Date.now() - new Date(prior.updatedAt).getTime() : Infinity;

    const state = await conversationStateRepository.ensure(conversationId, orgId, contactId);

    // Handed to a human: what happens next depends on WHY (handoffReason).
    // Human-owned hand-offs (a real agent replied / was assigned / manually
    // disabled the AI) are STICKY — the AI stays silent no matter how long the
    // conversation idles, so it can never barge into (or duplicate the enquiry
    // of) a slow-burn deal an agent is working across days. An agent brings it
    // back with the inbox toggle (enableAi). Only AI-caused hand-offs
    // (wound down / enquiry completed) auto-resume, and only after
    // RESUME_AFTER_MS of inactivity, with a clean slate.
    if (prior?.needsHuman) {
      const handoffReason = (prior.context as ConversationContext | null)?.handoffReason ?? "human_reply";
      if (handoffReason === "human_reply" || handoffReason === "manual_disable") {
        console.log(
          `[sendseven-webhook] conv ${conversationId} handed to human (reason=${handoffReason}) — sticky, staying silent until re-enabled`,
        );
        return;
      }
      if (inactiveMs < RESUME_AFTER_MS) {
        console.log(
          `[sendseven-webhook] conv ${conversationId} handed off (reason=${handoffReason}, active ${Math.round(inactiveMs / 1000)}s ago) — staying silent`,
        );
        return;
      }
      console.log(`[sendseven-webhook] conv ${conversationId} idle ${Math.round(inactiveMs / 60000)}m — AI re-engaging`);
      // Clear context too: stale groupedAskSent/availabilityTaskId/enquiryOwnerUserId
      // flags from the previous enquiry cycle must not leak into a fresh start.
      await conversationStateRepository.update(conversationId, {
        needsHuman: false,
        handledByHumanAt: null,
        enquiryStatus: null,
        enquirySlots: {},
        enquiryId: null,
        context: null,
      });
      state.needsHuman = false;
      state.enquiryStatus = null;
      state.enquirySlots = null;
      state.enquiryId = null;
      state.context = null;
    }

    // Resolve an EXISTING client (link or phone/email match). We do NOT auto-create
    // here — an unknown contact is asked for their details by the AI (below).
    let clientId = state.clientId;
    if (!clientId && contactId) {
      clientId = await resolveExistingClient(orgId, {
        id: contactId,
        name: contact?.name ?? null,
        phone: contact?.phone ?? null,
        email: contact?.email ?? null,
      });
      if (clientId) await conversationStateRepository.update(conversationId, { clientId });
    }
    const knownClient = !!clientId;

    // ── AI opt-in gate (default OFF) ─────────────────────────────────────
    // The bot only participates in a conversation an agent has opted in:
    // either this conversation carries an explicit override ("enabled" /
    // "disabled" — the inbox toggle), or it is linked to a client whose
    // aiReplyEnabled flag is ON. Everything else — including unknown
    // contacts — stays silent. The webhook still feeds the realtime inbox
    // either way (process() published before calling us).
    const aiOverride = state.aiOverride ?? null;
    if (aiOverride === "disabled") {
      console.log(`[sendseven-webhook] conv ${conversationId} AI override=disabled — staying silent`);
      return;
    }
    // Fetched once here (the gate needs the client's aiReplyEnabled) and
    // reused for the AI turn below — it used to be part of the parallel
    // batch inside runWithSendSevenConfigAsync.
    const client = clientId ? await neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null) : null;
    if (aiOverride !== "enabled" && !client?.aiReplyEnabled) {
      console.log(
        `[sendseven-webhook] conv ${conversationId} not opted in to AI (override=none client=${clientId ?? "none"} ` +
          `clientAi=${client ? String(!!client.aiReplyEnabled) : "n/a"}) — staying silent`,
      );
      return;
    }

    const cfg = await conversationIntegrationService.resolveConfig(orgId);
    if (!cfg) {
      console.warn(`[sendseven-webhook] org ${orgId} has no resolvable SendSeven config — skipping reply.`);
      return;
    }

    const integration = await conversationIntegrationRepository.findByOrg(orgId);
    const mode = integration?.autoReplyMode ?? "draft";

    await runWithSendSevenConfigAsync(cfg, async () => {
      // messagesRepository.list() needs the SendSeven config bound above, so it
      // can't join a Promise.all outside runWithSendSevenConfigAsync — but
      // there's no data dependency between it and botConfig/kb, so fold the
      // fetches into one parallel batch here. (The client record was already
      // fetched by the opt-in gate above.)
      const [botConfig, kb, list] = await Promise.all([
        botConfigRepository.findByOrg(orgId),
        knowledgeBaseRepository.list(orgId),
        messagesRepository.list({ conversationId, page: 1, pageSize: HISTORY_LIMIT }),
      ]);
      // Only feed the AI messages from THIS session (since our state row began), so
      // old, already-logged enquiries in the SendSeven history don't confuse it.
      // 60s buffer guards against clock skew dropping the current message.
      const since = state.createdAt ? new Date(state.createdAt).getTime() - 60_000 : 0;
      const recent = list.items.filter((m) => !m.created_at || new Date(m.created_at).getTime() >= since);
      const latestText = message.text?.trim() ?? "";
      const transcript = buildTranscript(recent, latestText);

      // A conversation can hold several enquiries. Once one is fully wrapped up
      // (scheduled), start the next from a clean slate (empty slots, no status)
      // so a NEW enquiry isn't blocked by the previous one or polluted by its
      // details. ("created" is kept for back-compat with rows written before
      // this flow existed.)
      const isFreshEnquiry = state.enquiryStatus === "created" || state.enquiryStatus === "scheduled";
      const enquiryStatus = isFreshEnquiry ? null : state.enquiryStatus;
      const priorSlots: EnquirySlots = isFreshEnquiry ? {} : ((state.enquirySlots as EnquirySlots) ?? {});

      // Read once, up here, so both the onboarding gate and the routing decision
      // below can use/persist it. `domain` records which bot the conversation is
      // in ("admin" once an admin-type ask has been detected & served).
      const prevContext = (state.context as ConversationContext | null) ?? {};
      // Computed once and reused below (deterministic route precedence) instead
      // of calling looksLikeAdminAsk(latestText) a second time for the same turn.
      const isAdminAsk = looksLikeAdminAsk(latestText);
      // Admin intent is often expressed BEFORE the contact is identified (the
      // customer asks about their enquiry, THEN we collect their phone). Carry it
      // across the onboarding detour so the just-onboarded completion turn —
      // whose literal message is only a phone number — still routes to admin.
      const sawAdminIntent = prevContext.domain === "admin" || isAdminAsk;

      const doHandoff = async (reply: string) => {
        // "ai_wound_down": the AI took itself out (customer asked for a person,
        // out of scope, or an internal failure) — a human is EXPECTED to pick
        // this up, and once they reply the message.sent detection overwrites
        // the reason with the sticky "human_reply". Until then the idle
        // auto-resume stays available so an unanswered thread isn't dead forever.
        await conversationStateRepository.setNeedsHuman(conversationId, undefined, "ai_wound_down");
        await messagesRepository.createInternalNote({
          conversation_id: conversationId,
          text: "🤖 AI handed this conversation to a human (customer asked for a person / out of scope).",
        });
        await sendReply(orgId, conversationId, message.channel_id, reply, mode, true);
      };

      // ── Upper-level ROUTER ─────────────────────────────────────────────
      // Decide which bot handles this turn BEFORE running any of them —
      // computed up here, BEFORE the onboarding gate, so a bare greeting or
      // general question from a brand-new contact goes straight to the general
      // route instead of being forced through name+phone collection. An
      // enquiry already in flight stays sales; an attachment on this message
      // (a document being submitted) or carried-over admin intent forces admin.
      // An enquiry is "in flight" — and must stay on SALES, never be pulled into
      // admin — once ANY of these hold: mid state-machine (collecting/
      // awaiting_availability), a grouped ask was sent, we've already captured
      // real holiday detail, or we're collecting a third-party (beneficiary)
      // enquiry. Broadened (2026-07-17) because the router mis-classified
      // mid-enquiry replies (a name+phone, a callback time) as admin, opening a
      // ticket instead of logging the enquiry — and admin stuck via context.domain.
      // Computed once and reused for the (unrelated) sales-bot retrieval gate
      // below (`enquiryish`) instead of re-running the same check on the same
      // (immutable) priorSlots later in the turn.
      const priorSubstantive = hasSubstantiveSignal(priorSlots);
      const enquiryInFlight =
        enquiryStatus === "collecting" ||
        enquiryStatus === "awaiting_availability" ||
        !!prevContext.groupedAskSent ||
        !!prevContext.beneficiary ||
        priorSubstantive;
      // The current message's own record from the batch fetched above — looked
      // up once and reused below for the attachment steps instead of a
      // second list.items.find() over the same (immutable) list.
      const currentMessage = list.items.find((m) => m.id === message.id);
      const currentAttachments = (currentMessage?.attachments ?? []).filter((a) => a?.id);
      // Attachment refs remembered from earlier, PRE-onboarding messages (see
      // pendingAttachmentRefs on ConversationContext) — kind-tagged at stash
      // time. Document refs keep the conversation deterministically on the
      // admin route until collected + ticketed (the consume step below, once
      // clientId is resolved); holiday_info refs are a SALES signal whose
      // stored details are re-injected below. Only ever set in the
      // non-beneficiary onboarding flow, so this can't hijack a beneficiary
      // enquiry's sales routing.
      const rememberedAttachmentRefs = prevContext.pendingAttachmentRefs ?? [];
      const hasAttachments = currentAttachments.length > 0 || rememberedAttachmentRefs.length > 0;

      // ── Attachment download + vision triage (BEFORE routing) ──────────
      // The current message's attachment bytes are downloaded up front — the
      // triage that classifies them (document vs holiday_info vs other) now
      // DRIVES the routing decision, so it can't wait until after the route
      // is picked like the old describe-only call did. Best-effort: a failed
      // download/triage degrades to the fail-safe document default below.
      const pendingAttachments: PendingAttachment[] = [];
      for (const att of currentAttachments) {
        try {
          const dl = await messagesRepository.downloadAttachment(att.id);
          pendingAttachments.push({ buffer: dl.buffer, filename: att.filename, contentType: att.content_type, size: att.file_size });
        } catch (err) {
          console.error(`[sendseven-webhook] conv ${conversationId} failed to download attachment ${att.id}:`, err);
        }
      }
      const imageTriage = pendingAttachments.length ? await triageImageAttachments(pendingAttachments, { orgId }) : null;
      // Effective attachment kind for routing, folding in remembered refs:
      // any document (or untriaged — fail-safe) attachment wins; else any
      // holiday_info one; else "other"/none. Refs stashed before kind-tagging
      // existed have no kind and default to document (their old behavior).
      // effectiveAttachmentKind: null triage → document (fail-safe); triage
      // "other" but the customer SAYS it's a document ("heres my passport")
      // → the customer's words win — vision can misjudge real-world photos.
      const currentKind = currentAttachments.length ? effectiveAttachmentKind(imageTriage?.kind ?? null, latestText) : null;
      const rememberedKinds = rememberedAttachmentRefs.map((r) => r.kind ?? "document");
      const anyDocument = currentKind === "document" || rememberedKinds.includes("document");
      // holidayImageInfo persisting from a PRIOR turn counts too: a customer
      // who sent a deal advert stays deterministically on SALES for the whole
      // collecting flow — without this, a follow-up turn with no attachment
      // ("october 2nd") falls to the LLM classifier, which can misread "other
      // dates for this deal" as amending an existing booking → admin → a
      // spurious ticket. Documents and deterministic admin signals
      // (complaint / providing details / admin ask) still take precedence —
      // see decideDeterministicRoute.
      const anyHolidayInfo =
        currentKind === "holiday_info" || rememberedKinds.includes("holiday_info") || !!prevContext.holidayImageInfo;
      const attachmentKind = anyDocument ? ("document" as const) : anyHolidayInfo ? ("holiday_info" as const) : currentKind;
      // A holiday_info image's extracted details (this turn's triage + any
      // remembered from the onboarding detour) are ACCUMULATED in the context
      // (containment-deduped, capped) and injected into the transcript the AI
      // sees on EVERY collecting turn — treated as stated by the customer, so
      // the sales bot extracts slots from them and only asks for what's
      // missing, with every later turn as a second chance for fields it
      // missed. Mutating prevContext means every later context persist
      // carries it; the enquiry-create / hand-off / reset paths build fresh
      // contexts, clearing it.
      const holidayImageDetails =
        attachmentKind === "holiday_info"
          ? [
              ...(imageTriage?.kind === "holiday_info" ? [imageTriage.description] : []),
              ...rememberedAttachmentRefs.filter((r) => r.kind === "holiday_info" && r.description).map((r) => r.description as string),
            ]
          : [];
      for (const detail of holidayImageDetails) {
        const existing = prevContext.holidayImageInfo ?? "";
        if (!existing.includes(detail.slice(0, 120))) {
          prevContext.holidayImageInfo = `${existing} ${detail}`.trim().slice(0, 1500);
        }
      }
      const imageInfoNote = prevContext.holidayImageInfo
        ? `[Details from the image(s) I've sent in this chat — treat these as details I've stated: ${prevContext.holidayImageInfo}]`
        : null;
      // What the LLMs read. The stored message history keeps only real
      // message text — the image details ride along via the note; anything
      // worth keeping lands in the extracted slots, which persist. A document
      // attachment gets its own line so the (pre-onboarding) turn KNOWS a
      // file arrived and acknowledges it while asking for name+phone, instead
      // of replying as if the message were empty chat.
      const documentAttachmentLine =
        currentKind === "document"
          ? `Customer: [I've attached ${currentAttachments.length === 1 ? "a file" : "files"}: ${currentAttachments.map((a) => a.filename).join(", ")}]`
          : null;
      const transcriptForAi = [transcript, imageInfoNote ? `Customer: ${imageInfoNote}` : null, documentAttachmentLine]
        .filter(Boolean)
        .join("\n");

      // (3.2) A deterministic ACTIONABLE admin signal (complaint / verification
      // details) or a DOCUMENT attachment on THIS turn breaks OUT of
      // enquiryInFlight stickiness — a customer mid-enquiry who says "my existing
      // booking is filthy, I want a refund" must reach the admin bot, not be
      // funneled into holiday slot-filling. A merely admin-ish but NON-actionable
      // question (looksLikeAdminAsk, e.g. "what's the status of my enquiry?")
      // does NOT break out — it stays sales-sticky exactly as before. This takes
      // precedence over enquiryInFlight below; everything else is unchanged.
      // (3.2) Deterministic route precedence — see decideDeterministicRoute for
      // the full rationale (incl. the attachment-kind semantics); shared with
      // internal-chat-testflow so the two drivers can't drift.
      const deterministicRoute = decideDeterministicRoute({
        enquiryInFlight,
        hasAttachments,
        attachmentKind,
        actionable: looksLikeActionableAdmin(latestText),
        adminAsk: isAdminAsk,
      });
      const complaintBreaksOutOfEnquiry = enquiryInFlight && deterministicRoute === "admin";
      // Do NOT force admin purely because a PRIOR turn set domain="admin" (sticky).
      // A single router misfire would otherwise trap the whole conversation in
      // admin and open a ticket instead of logging a sales enquiry. An attachment
      // (document submission) or a DETERMINISTIC admin ask forces admin; otherwise
      // the classifier decides, with the prior domain as a sticky HINT so genuine
      // admin follow-ups stay admin but a clear new-holiday message recovers to sales.
      const route: "sales" | "admin" | "general" =
        deterministicRoute !== "classify"
          ? deterministicRoute
          : await classifyConversationRoute({
              transcript: transcriptForAi,
              latestText,
              enquiryInFlight,
              priorDomainAdmin: prevContext.domain === "admin",
              orgId,
            });
      console.log(
        `[sendseven-webhook] conv=${conversationId} ROUTE=${route} enquiryInFlight=${enquiryInFlight} ` +
          `complaintBreakout=${complaintBreaksOutOfEnquiry} status=${enquiryStatus} groupedAskSent=${!!prevContext.groupedAskSent} ` +
          `beneficiary=${!!prevContext.beneficiary} sawAdminIntent=${sawAdminIntent} domain=${prevContext.domain ?? "none"} attachments=${hasAttachments}`,
      );

      // ── General route ────────────────────────────────────────────────
      // No booking or admin intent — just converse normally. No identity is
      // needed, so this skips both the onboarding gate and the enquiry bot's
      // slot-filling entirely.
      if (route === "general") {
        if (!hasText) return; // nothing to reply to
        // Atomic per-message claim (same mechanism as claimAdminTurn — see
        // sendsevenWebhookRepository.claimReplyTurn): SendSeven can redeliver
        // the same message under a DIFFERENT event_id, which recordEvent's
        // eventId dedupe doesn't catch. Without this, a redelivery would send
        // a second, duplicate customer-facing reply. Losing the claim (or no
        // message id to claim on) returns silently, same as the admin path.
        if (!(await claimReply(conversationId, orgId, message.id))) return;
        const reply = await generateGeneralReply(botConfig, kb, transcript, client);
        try {
          await sendReply(orgId, conversationId, message.channel_id, reply, mode, false);
        } catch (err) {
          // The claim was won but the send itself failed — release it so a
          // genuine redelivery of this message can retry rather than the
          // message going permanently unanswered.
          await releaseReplyClaim(message.id);
          throw err;
        }
        await conversationStateRepository.update(conversationId, {
          intent: "other",
          lastAiReplyAt: new Date(),
          context: { ...prevContext, lastReply: reply },
        });
        return;
      }

      // ── Vector retrieval (Phase 5d) — best-effort context for the sales bot's
      // generateTurn call(s). Computed up here (BEFORE the onboarding gate,
      // instead of just before the sales generateTurn call further below) so
      // an unknown-contact turn that completes onboarding in this SAME message
      // (name+phone supplied) can pass it into ITS generateTurn call too — see
      // the onboarding gate below, which then reuses that one turn's output
      // instead of running generateTurn a second time with the resolved
      // identity (fixing a double LLM call that discarded the first turn's
      // extracted slots/reply). Gated to route==="sales" — general already
      // returned above, and admin never uses retrieval — so this computes
      // exactly when it used to (previously unreachable for admin/general
      // since they always returned/branched off before reaching the old call
      // site further down).
      let retrieved: RetrievedContext = { kb: [], quotes: [] };
      if (route === "sales") {
        const enquiryish = enquiryStatus === "collecting" || enquiryStatus === "awaiting_availability" || priorSubstantive;
        const kbOverflow = kbExceedsBudget(kb);
        const [kbMatches, quoteMatches] = await Promise.all([
          kbOverflow
            // audience: "sales" pushes the audience filter into SQL so top-k
            // returns eligible rows only (admin-audience KB can't crowd out
            // sales matches). The JS-side retrievedAudienceAllows filter in
            // buildSystemPrompt stays as defense-in-depth. Deliberately NOT
            // set on the quote retrieval below — quote embeddings carry no
            // audience metadata and the fail-closed predicate would exclude
            // them all.
            ? aiEmbeddingsService.retrieve({ orgId, sourceType: "knowledge", query: imageInfoNote ? `${latestText} ${imageInfoNote}` : latestText, limit: 3, audience: "sales" })
            : Promise.resolve([] as RetrievedMatch[]),
          enquiryish
            ? aiEmbeddingsService.retrieve({
                orgId,
                sourceType: "quote",
                query: `${imageInfoNote ? `${latestText} ${imageInfoNote}` : latestText} ${JSON.stringify(priorSlots)}`,
                limit: 4,
              })
            : Promise.resolve([] as RetrievedMatch[]),
        ]);
        retrieved = { kb: kbMatches, quotes: quoteMatches };
      }

      // Carries the onboarding turn's AiTurn forward when this SAME message
      // both completes onboarding (name+phone given) AND has enough signal to
      // continue straight into the sales flow — set below, just before falling
      // through past the onboarding gate. When set, the sales section further
      // down reuses it instead of calling generateTurn a second time (Fix 2).
      let firstTurn: AiTurn | null = null;

      // Client onboarding gate: for an unknown contact, collect full name + phone
      // ONLY (no email). If both arrive (even in the same message), create + link
      // and FALL THROUGH to process the enquiry in the same turn.
      if (!knownClient) {
        const onboard = await generateTurn(botConfig, kb, null, transcriptForAi, enquiryStatus, priorSlots, false, retrieved);
        console.log(
          `[sendseven-webhook] conv=${conversationId} onboarding (unknown contact) mode=${mode} handoff=${onboard.hand_off} ` +
            `adminIntent=${sawAdminIntent} hasName=${!!onboard.client?.fullName} hasPhone=${!!onboard.client?.phone} ` +
            `onBehalf=${!!onboard.beneficiary?.onBehalf}`,
        );
        // Third-party enquiry ("my friend James wants to book…"): the enquiry
        // belongs to the traveller, not the sender — so do NOT onboard the sender.
        // Fall through to the sales flow, which collects the traveller's phone and
        // files the enquiry under them (the beneficiary gate below). Seed the
        // beneficiary context so the sales turn stays in on-behalf mode even if
        // the model drops the flag on the next turn. NOTE: firstTurn is
        // deliberately left unset for a beneficiary enquiry — the sales turn
        // there resolves a DIFFERENT identity (the traveller, not the sender)
        // and genuinely needs its own fresh generateTurn call.
        const beneficiaryEnquiry = !!prevContext.beneficiary || !!onboard.beneficiary?.onBehalf;
        if (beneficiaryEnquiry && !prevContext.beneficiary) {
          prevContext.beneficiary = { name: cleanTravellerName(onboard.beneficiary?.fullName) };
        }
        if (!beneficiaryEnquiry) {
        // Attachment deferral: a file on THIS pre-onboarding message can't be
        // downloaded yet (no clientId to act for), and the download step below
        // only ever reads the CURRENT message — so remember its id/metadata in
        // the context. The turn that completes onboarding collects it into the
        // ticket flow (see the download step), and hasAttachments above keeps
        // the conversation on the admin route until then. Mutates prevContext
        // so every context persist below (missing-details, phone-conflict)
        // carries it without each write site needing to know.
        if (currentAttachments.length) {
          const priorRefs = prevContext.pendingAttachmentRefs ?? [];
          const freshRefs = currentAttachments
            .filter((a) => !priorRefs.some((r) => r.id === a.id))
            .map((a, i) => ({
              id: a.id,
              filename: a.filename,
              contentType: a.content_type,
              size: a.file_size,
              // Carry this turn's triage so the consume turn can route and
              // re-inject holiday details WITHOUT re-running vision. The
              // (message-level) description is stored on the first ref of the
              // batch only, capped — refs live in the context jsonb.
              kind: currentKind ?? undefined,
              description: i === 0 && imageTriage?.description ? imageTriage.description.slice(0, 600) : undefined,
            }));
          if (freshRefs.length) {
            prevContext.pendingAttachmentRefs = [...priorRefs, ...freshRefs];
            console.log(
              `[sendseven-webhook] conv ${conversationId} deferring ${freshRefs.length} attachment(s) (kind=${currentKind ?? "unknown"}) until onboarding completes (no clientId yet)`,
            );
          }
        }
        // An admin matter (complaint, document, account query) — recognised by the
        // ROUTE (the classifier catches complaints like "my room is filthy" that
        // the keyword check misses) or the deterministic admin signal. Don't hand
        // off during onboarding for these: collect name+phone, then the admin bot
        // opens a ticket once they're identified. Only a NON-admin hand_off (asked
        // for a human, off-topic) actually hands off here.
        const adminMatter = route === "admin" || sawAdminIntent;
        if (onboard.hand_off && !adminMatter) return doHandoff(onboard.reply);

        const full = onboard.client?.fullName?.trim();
        const phone = onboard.client?.phone?.trim();
        if (!(full && phone && contactId)) {
          // Still missing details — ask for them and stop here. Persist the admin
          // intent (domain) so it survives to the completion turn, where the admin
          // bot serves the request. A document sent on THIS turn gets a
          // deterministic reply (confirm receipt + ask name/phone) — the
          // general onboarding turn can't be trusted with attachments (it
          // tends to deny being able to "view" them).
          const onboardingReply =
            currentKind === "document" ? await generateDocumentReceivedAsk(botConfig, kb, { orgId }) : onboard.reply;
          await sendReply(orgId, conversationId, message.channel_id, onboardingReply, mode, false);
          await conversationStateRepository.update(conversationId, {
            lastAiReplyAt: new Date(),
            ...(adminMatter
              ? {
                  context: {
                    ...prevContext,
                    domain: "admin" as const,
                    // Remember an actionable complaint/submission stated NOW (e.g.
                    // "my room is filthy") so it survives to the post-onboarding
                    // admin turns whose messages are just a name/phone.
                    adminActionable: prevContext.adminActionable || looksLikeActionableAdmin(latestText),
                  },
                }
              : // Defensive: an attachment always forces route="admin" (so
                // adminMatter above is true), but if that ever changes, the
                // deferred refs stashed into prevContext must still be
                // persisted or the file is lost.
                prevContext.pendingAttachmentRefs?.length
                ? { context: { ...prevContext } }
                : {}),
          });
          return;
        }
        // Phone ↔ name allocation. If the number is already on file under a
        // DIFFERENT client's name we asked the customer to confirm it last turn
        // (phoneConflictPhone). If they're standing by the SAME number, take that
        // as confirmation it's genuinely theirs and register them as a NEW client
        // under the name they gave — never fold them into the other client's
        // record. A different number means they corrected it → re-resolve below.
        const pendingConflictPhone = prevContext.phoneConflictPhone;
        if (pendingConflictPhone && samePhoneNumber(pendingConflictPhone, phone)) {
          clientId = await createNewClientAndLink(orgId, contactId, { fullName: full, phone, email: null });
          delete prevContext.phoneConflictPhone;
          await conversationStateRepository.update(conversationId, { clientId, context: { ...prevContext } });
          console.log(`[sendseven-webhook] conv ${conversationId} phone confirmed after clash — created new client ${clientId}`);
        } else {
          const resolution = await resolveClientForOnboarding(orgId, contactId, { fullName: full, phone, email: null });
          if (resolution.status === "phone_conflict") {
            const confirmReply = buildPhoneConflictReply();
            await sendReply(orgId, conversationId, message.channel_id, confirmReply, mode, false);
            await conversationStateRepository.update(conversationId, {
              lastAiReplyAt: new Date(),
              context: {
                ...prevContext,
                ...(sawAdminIntent ? { domain: "admin" as const } : {}),
                phoneConflictPhone: phone,
                lastReply: confirmReply,
              },
            });
            console.log(
              `[sendseven-webhook] conv ${conversationId} phone clash — number belongs to ${resolution.existingNames.length} existing client(s); asked to confirm`,
            );
            return;
          }
          clientId = resolution.clientId;
          delete prevContext.phoneConflictPhone;
          await conversationStateRepository.update(conversationId, { clientId, context: { ...prevContext } });
          console.log(`[sendseven-webhook] Linked client ${clientId} for conv ${conversationId} (collected details)`);
        }
        // Onboarding completed (name+phone resolved) on THIS message, with no
        // early return above — the sales section below reuses this turn's
        // reply/slots/intent instead of calling generateTurn again (Fix 2:
        // avoids discarding this turn's extraction and re-deriving it from the
        // same transcript a second time).
        firstTurn = onboard;
        } // end !beneficiaryEnquiry — a third-party enquiry falls through to sales below
      }

      // Known client (already, or just onboarded) → the enquiry/reply turn.
      const clientRecord = knownClient
        ? client
        : clientId
          ? await neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null)
          : null;

      // ── Deferred-attachment consume (SendSeven only) ───────────────────
      // The CURRENT message's bytes were already downloaded (pre-routing, for
      // the triage). Here, once clientId is resolved, collect any DOCUMENT
      // refs remembered from pre-onboarding messages — downloaded now so the
      // admin bot can attach them to the ticket it opens. holiday_info refs
      // need no bytes (their stored details were re-injected into
      // transcriptForAi above). Files are NOT saved to the client's files —
      // staff can move them there from the ticket. Best-effort: a failed
      // download never breaks the reply.
      const rememberedDocRefsNow = clientId
        ? rememberedAttachmentRefs.filter((r) => (r.kind ?? "document") === "document" && !currentAttachments.some((a) => a.id === r.id))
        : [];
      for (const ref of rememberedDocRefsNow) {
        try {
          const dl = await messagesRepository.downloadAttachment(ref.id);
          // Prepend — deferred files arrived before the current message's.
          pendingAttachments.unshift({ buffer: dl.buffer, filename: ref.filename, contentType: ref.contentType, size: ref.size });
        } catch (err) {
          console.error(`[sendseven-webhook] conv ${conversationId} failed to download deferred attachment ${ref.id}:`, err);
        }
      }
      // Consume-once: the deferred refs have now been actioned (or attempted —
      // a persistently failing download must not force the admin route forever).
      // Deleting from prevContext means whichever branch persists context next
      // drops the marker; if this turn dies before any persist, the refs are
      // still in the DB and a redelivery retries the collection. Read from
      // prevContext (NOT the rememberedAttachmentRefs captured up top): when
      // onboarding completed on THIS same message, the gate stashed refs for
      // the current attachments AFTER that capture — those are already covered
      // by the pre-routing download and must be cleared too.
      if (prevContext.pendingAttachmentRefs?.length && clientId) {
        delete prevContext.pendingAttachmentRefs;
        if (rememberedAttachmentRefs.length) {
          console.log(
            `[sendseven-webhook] conv ${conversationId} consumed ${rememberedAttachmentRefs.length} deferred attachment ref(s) (${rememberedDocRefsNow.length} document file(s) collected)`,
          );
        }
      }
      // Document-submission note for the admin bot — built from the triage
      // that already ran (plus any stored deferred-document descriptions), so
      // the ticket carries what the image shows, not just a filename. NOT
      // built for holiday_info images: those aren't a document submission —
      // their details went to the sales bot via transcriptForAi instead. A
      // null triage (vision failed) keeps the pre-vision wording — the
      // attachment is still ticketed.
      const documentDescriptions =
        attachmentKind === "holiday_info"
          ? []
          : [
              ...(imageTriage && imageTriage.kind !== "holiday_info" ? [imageTriage.description] : []),
              ...rememberedDocRefsNow.map((r) => r.description).filter((d): d is string => !!d),
            ];
      const imageDescription = documentDescriptions.length ? documentDescriptions.join(" ") : null;
      const attachmentNote =
        pendingAttachments.length && attachmentKind !== "holiday_info"
          ? `The customer has just sent the following file(s) in their latest message: ${pendingAttachments.map((a) => a.filename).join(", ")}. ` +
            (imageDescription
              ? `AI-read summary of the image(s), UNVERIFIED — a colleague must still review the actual file(s): ${imageDescription} ` +
                "Include these AI-read details in the ticket description so staff have context. "
              : "") +
            "Treat this as a document submission: use open_ticket to log it for a colleague — the file(s) will be attached to that ticket automatically. Then confirm to the customer you've received and logged it. Do NOT claim to have checked or verified the document yourself."
          : undefined;
      if (pendingAttachments.length && attachmentNote) {
        console.log(`[sendseven-webhook] conv ${conversationId} holding ${pendingAttachments.length} attachment(s) for a ticket`);
      }

      // Nothing actionable (a media message we couldn't download, or an empty
      // text with no usable image) — stay silent rather than replying to nothing.
      if (!hasText && !attachmentNote && !imageInfoNote) return;

      // `route` was already decided above (before onboarding). Saved
      // attachments and admin intent carried across the onboarding detour
      // (sawAdminIntent) already fed into that decision.

      // ── Admin bot ──────────────────────────────────────────────────────
      // Fail-closed on clientId (only ever set via a verified link / phone-email
      // match / onboarding). The admin bot answers from the client's OWN records.
      if (route === "admin" && clientId) {
        // Atomic claim on THIS inbound message before running a turn that may
        // open a ticket: SendSeven can redeliver the same webhook event (or we
        // can otherwise process the same message twice), and both deliveries
        // would otherwise reach adminAgent.answer() before either persists
        // ticketOpened, opening duplicate tickets. If we lose the claim (or
        // there's no message id to claim on), skip this turn silently rather
        // than double-act — the winning caller already handles it. See
        // sendsevenWebhookRepository.claimAdminTurn.
        if (message.id) {
          const claimedAdminTurn = await sendsevenWebhookRepository.claimAdminTurn(message.id, orgId);
          if (!claimedAdminTurn) {
            console.log(`[sendseven-webhook] conv ${conversationId} lost the admin-turn claim for message ${message.id} — skipping to avoid a duplicate ticket`);
            return;
          }
        } else {
          console.warn(`[sendseven-webhook] conv ${conversationId} admin turn has no message id — proceeding WITHOUT a claim`);
        }

        // Actionable = complaint / details / document submission (needs a ticket),
        // vs a read-only records query. `shouldForceTicketNow` gates the force on
        // two things: we already asked a clarifying question without opening a
        // ticket (adminAsked), AND the CURRENT turn actually carries signal —
        // either it's itself deterministically actionable (a fresh
        // complaint/detail/document), or it's a substantive answer to that
        // clarifying question (not a bare "thanks"/"ok" acknowledgement, which
        // must never trigger the force). `adminActionable` below is a STICKY
        // flag persisted in context for logging/observability only — it is NOT
        // read by the force gate, since once true it never clears and would
        // otherwise force a ticket on an unrelated later "thanks".
        const adminActionable = !!prevContext.adminActionable || looksLikeActionableAdmin(latestText) || !!attachmentNote;
        const forceTicketNow = shouldForceTicketNow({
          adminAsked: prevContext.adminAsked,
          ticketOpened: prevContext.ticketOpened,
          latestText,
          hasAttachment: !!attachmentNote,
        });
        console.log(
          `[sendseven-webhook] conv=${conversationId} route=admin known=${knownClient} attachments=${!!attachmentNote} ` +
            `actionable=${adminActionable} adminAsked=${!!prevContext.adminAsked} forceTicket=${forceTicketNow} -> admin agent`,
        );
        const adminResult = await adminAgent.answer(
          orgId,
          clientId,
          botConfig,
          kb,
          transcript,
          clientRecord,
          attachmentNote,
          pendingAttachments,
          !!prevContext.ticketOpened,
          forceTicketNow,
        );
        if (adminResult) {
          try {
            await sendReply(orgId, conversationId, message.channel_id, adminResult.reply, mode, false);
          } catch (err) {
            // The admin-turn claim was won (and the ticket, if any, already
            // opened by adminAgent.answer) but the reply itself failed to
            // send — release the claim so a genuine redelivery of this same
            // message can retry rather than the customer going permanently
            // unanswered.
            if (message.id) await sendsevenWebhookRepository.releaseAdminTurnClaim(message.id);
            throw err;
          }
          const ticketOpenedNow = prevContext.ticketOpened || adminResult.ticketOpened;
          await conversationStateRepository.update(conversationId, {
            intent: "other",
            lastAiReplyAt: new Date(),
            context: {
              ...prevContext,
              lastReply: adminResult.reply,
              domain: "admin",
              ticketOpened: ticketOpenedNow,
              adminActionable,
              // Mark that we've engaged once — so a follow-up actionable turn forces
              // the ticket instead of looping. Cleared implicitly once a ticket exists.
              adminAsked: prevContext.adminAsked || !ticketOpenedNow,
            },
          });
          return;
        }
        // Admin agent failed hard — hand off cleanly rather than falling through.
        return doHandoff("Let me get a colleague to help you with that.");
      }

      // ── Sales / enquiry bot ──────────────────────────────────────────────
      // Retrieval (`retrieved`) was already computed above, before the
      // onboarding gate, using the same enquiryish/kbOverflow gating as
      // before — see the comment there.
      //
      // Reuse the onboarding turn's AiTurn (Fix 2) when THIS message both
      // completed onboarding and already produced a usable turn — set only
      // when the onboarding gate fell through with no early return (see
      // `firstTurn = onboard` above). Skips a second generateTurn call that
      // would otherwise re-derive the same slots/reply from the identical
      // transcript, just with knownClient now true and (usually) no
      // meaningfully different retrieval/identity context — the onboarding
      // prompt already includes the full enquiry-extraction + retrieval
      // instructions and explicitly handles "customer just gave name+phone
      // AND holiday interest in one message" (see buildSystemPrompt's
      // onboarding tail block). The only context this skips is the resolved
      // NeonClient's name (a personalization nicety, not used for
      // extraction/correctness) — an acceptable trade-off to avoid the
      // redundant LLM call and the slot-discarding bug it caused.
      const turn = firstTurn ?? (await generateTurn(botConfig, kb, clientRecord, transcriptForAi, enquiryStatus, priorSlots, true, retrieved));
      console.log(
        `[sendseven-webhook] conv=${conversationId} known=${knownClient} mode=${mode} intent=${turn.intent} ` +
          `handoff=${turn.hand_off} status=${enquiryStatus}`,
      );

      if (turn.hand_off) return doHandoff(turn.reply);

      // Safe access: a holiday_info image with no caption reaches here with no
      // text at all (the old code never did — text-less turns were admin-only).
      const customerAcked = isAcknowledgement((message.text ?? "").trim());
      const lastReply = prevContext.lastReply ?? "";
      const wouldRepeat = similarReply(turn.reply, lastReply);

      const update: Partial<SendsevenConversationState> = {
        lastAiReplyAt: new Date(),
        context: { ...prevContext, lastReply: turn.reply },
      };

      // Server-truth slots for this turn: merge the model's output onto what we
      // already had persisted, so a terse final reply can't drop earlier fields.
      const mergedSlots = mergeSlots(priorSlots, turn.slots);

      // Deterministic holidayType backstop: the model's slot extraction is
      // unreliable turn-to-turn (it can return empty slots even when "cruise"
      // is plainly in the transcript), so if holidayType still hasn't landed,
      // recover it deterministically from the full transcript rather than
      // silently falling through to the Package Holiday default at creation.
      if (!mergedSlots.holidayType) {
        const inferred = inferHolidayTypeFromText(transcriptForAi);
        if (inferred) mergedSlots.holidayType = inferred;
      }

      // ── Third-party enquiry ("on behalf of a friend") ──────────────────
      // "my friend James wants to book Benidorm" — the enquiry belongs to the
      // named traveller, not the sender. We must resolve/create the traveller
      // (name + phone) FIRST, then the enquiry is filed under them. Until we can,
      // we deterministically ask for the traveller's phone (and name if we don't
      // have one) rather than drifting into holiday questions. Defaults to the
      // sender's own client id when this isn't on anyone's behalf.
      let enquiryClientId = clientId;
      const benTurn = turn.beneficiary;
      const benCtx = prevContext.beneficiary;
      const beneficiaryActive = !!benCtx || !!benTurn?.onBehalf;
      if (beneficiaryActive && enquiryStatus !== "awaiting_availability") {
        const travellerName = cleanTravellerName(benTurn?.fullName) || benCtx?.name;
        let benClientId = benCtx?.clientId;
        // Robust phone capture: the model's field OR a phone-shaped token in the
        // latest message OR one we remembered — so a bare "09355152084" is caught
        // even when the model stops echoing it back. Only TRUST the free-text
        // extraction while we're actually in the phone-collection step (the
        // traveller isn't resolved yet) — once benClientId is set, a later,
        // unrelated large number in the conversation (e.g. a reference) must
        // never overwrite the phone we already resolved them by.
        const travellerPhone =
          (
            benTurn?.phone?.trim() ||
            (!benClientId ? extractPhoneNumber(latestText) : null) ||
            benCtx?.phone ||
            ""
          ).trim() || undefined;

        if (!benClientId) {
          if (!travellerName || !travellerPhone) {
            // We still need the traveller's NAME and/or phone before we can log
            // the enquiry under them — ask for exactly what's missing (never
            // invent a placeholder name). Hold the enquiry until we have both.
            // (3.3) Generated in the org's voice/language via the brain rather
            // than a hard-coded English string — one cheap, short-prompt call,
            // falling back to the fixed English line on any failure.
            const askKind: BeneficiaryAskKind = !travellerName && !travellerPhone ? "name_and_phone" : !travellerName ? "name" : "phone";
            const ask = await generateBeneficiaryAsk(botConfig, kb, askKind, travellerName, { orgId });
            await sendReply(orgId, conversationId, message.channel_id, ask, mode, false);
            await conversationStateRepository.update(conversationId, {
              intent: "enquiry",
              enquiryStatus: "collecting",
              enquirySlots: mergedSlots,
              lastAiReplyAt: new Date(),
              context: { ...prevContext, lastReply: ask, beneficiary: { name: travellerName, phone: travellerPhone } },
            });
            console.log(`[sendseven-webhook] conv ${conversationId} on-behalf enquiry — asking for traveller name/phone (name=${travellerName ?? "?"} phone=${redactPhone(travellerPhone)})`);
            return;
          }

          // Have a real name + phone → resolve/create the traveller. NO contact
          // link — the traveller isn't the person messaging. A transient DB
          // failure here must not fall through as a silent no-reply turn — hand
          // off instead, mirroring the enquiry-create hardening below.
          try {
            const pendingBenConflict = benCtx?.phoneConflictPhone;
            if (pendingBenConflict && samePhoneNumber(pendingBenConflict, travellerPhone)) {
              benClientId = await insertClient(orgId, { fullName: travellerName, phone: travellerPhone });
              console.log(`[sendseven-webhook] conv ${conversationId} beneficiary phone confirmed after clash — created client ${benClientId} for ${travellerName}`);
            } else {
              const resolution = await resolveOrCreateByDetails(orgId, { fullName: travellerName, phone: travellerPhone });
              if (resolution.status === "phone_conflict") {
                const confirmReply = buildPhoneConflictReply(travellerName);
                await sendReply(orgId, conversationId, message.channel_id, confirmReply, mode, false);
                await conversationStateRepository.update(conversationId, {
                  intent: "enquiry",
                  enquiryStatus: "collecting",
                  enquirySlots: mergedSlots,
                  lastAiReplyAt: new Date(),
                  context: {
                    ...prevContext,
                    lastReply: confirmReply,
                    beneficiary: { name: travellerName, phone: travellerPhone, phoneConflictPhone: travellerPhone },
                  },
                });
                console.log(
                  `[sendseven-webhook] conv ${conversationId} beneficiary phone clash — number belongs to ${resolution.existingNames.length} existing client(s); asked to confirm`,
                );
                return;
              }
              benClientId = resolution.clientId;
            }
          } catch (err) {
            console.error(`[sendseven-webhook] conv ${conversationId} beneficiary resolve/insert THREW:`, err);
            return doHandoff("Sorry, I'm having trouble setting that up right now — let me get a colleague to help you.");
          }
          console.log(`[sendseven-webhook] conv ${conversationId} on-behalf enquiry — traveller client ${benClientId} (${travellerName})`);
        }

        // Traveller resolved → file the enquiry under them, and persist so later
        // turns skip resolution and never re-ask their name. Mutating prevContext
        // means every downstream context spread keeps it (until the enquiry is
        // created, which drops it).
        enquiryClientId = benClientId ?? clientId;
        prevContext.beneficiary = { name: travellerName, phone: travellerPhone, clientId: benClientId };
        update.context = { ...prevContext, lastReply: turn.reply };
      }

      // Computed once and reused by both `treatAsEnquiry` below and the create
      // trigger further down, instead of calling hasSubstantiveSignal(mergedSlots)
      // twice for the same (immutable) mergedSlots.
      const substantive = hasSubstantiveSignal(mergedSlots);

      // Enquiry-ness for the branches below. Once the customer has given real
      // holiday signal (destination/dates/pax/budget…), treat it as an enquiry
      // even if the model labels the turn intent="other" — it routinely does that
      // when it prematurely closes with "the team will call you", which must NOT
      // drop the enquiry on the floor. `beneficiaryActive` kept for clarity.
      const treatAsEnquiry = turn.intent === "enquiry" || substantive || beneficiaryActive;

      // "Additional fields still needed" (ALL fields, incl. nice-to-haves) —
      // no longer a create gate; only used for the note on enquiry creation
      // (and for observability in the log line below).
      const missingBeforeCreate = missingFieldsFor(mergedSlots);

      // Required-CORE gate: while any of these are missing (and the ask-cap
      // hasn't been hit), keep collecting naturally instead of creating.
      const coreMissing = missingCoreFieldsFor(mergedSlots);
      const askCount = prevContext.askCount ?? 0;

      // Create trigger, computed up here so we can log the full decision state
      // in one place before branching. Fires — on THIS SAME TURN — once we're
      // treating this as an enquiry with real signal AND either the required
      // core fields are complete, the ask-cap has been reached, or this
      // conversation already sent the (now-legacy) grouped ask on a prior turn
      // (a conversation that started under the old flow) — no more waiting
      // for a further customer reply. See shouldCreateEnquiryNow.
      const readyToCreate =
        treatAsEnquiry &&
        substantive &&
        shouldCreateEnquiryNow({
          coreMissingCount: coreMissing.length,
          askCount,
          groupedAskSentLegacy: !!prevContext.groupedAskSent,
          // The model's own completion signal — a declined core field ("any
          // date is fine") leaves its slot empty, so without this the gate
          // would deadlock: the model stops asking while coreMissing stays >0.
          modelSaysComplete: !!turn.complete,
        });

      // One structured line capturing every input to the enquiry state machine —
      // so when creation doesn't happen we can see exactly why (which flag/branch).
      // Logs slot KEYS only (never the raw values — destination/notes/etc. can
      // carry customer PII) so this stays useful for debugging state transitions
      // without dumping personal data into the log stream.
      console.log(
        `[sendseven-webhook] conv=${conversationId} ENQUIRY-DECISION route=${route} intent=${turn.intent} ` +
          `status=${enquiryStatus} groupedAskSentLegacy=${!!prevContext.groupedAskSent} substantive=${substantive} ` +
          `treatAsEnquiry=${treatAsEnquiry} missing=${missingBeforeCreate.length}[${missingBeforeCreate.join("|")}] ` +
          `readyToCreate=${readyToCreate} beneficiary=${beneficiaryActive} enquiryClientId=${enquiryClientId ?? "null"} ` +
          `coreMissing=${coreMissing.length} askCount=${askCount} modelComplete=${!!turn.complete} ` +
          `mergedSlotKeys=[${Object.keys(mergedSlots).join(",")}] rawTurnSlotKeys=[${Object.keys(turn.slots).join(",")}]`,
      );

      // Step: awaiting_availability — the enquiry is already created; this reply
      // is the customer's stated callback time. Parse it, create ONE task, confirm,
      // and hand off. The transition is CLAIMED atomically before the task is
      // created — a retried/concurrent inbound that loses the claim does nothing.
      if (enquiryStatus === "awaiting_availability") {
        const claimed = await conversationStateRepository.claimStatusTransition(conversationId, "awaiting_availability", "scheduled");
        if (!claimed) {
          console.log(`[sendseven-webhook] conv ${conversationId} lost the schedule-callback claim — already actioned, skipping`);
          return;
        }

        const rawTime = (message.text ?? "").trim();
        const confirmReply = await generateTransitionReply(botConfig, kb, "callback_booked", rawTime, prevContext.onBehalfOfName, { orgId });
        let taskId: string | undefined;
        if (state.enquiryId && prevContext.enquiryOwnerUserId) {
          const dueDate = await parseAvailabilityTime(rawTime, { orgId });
          const created = await taskService.create(
            {
              entityType: "enquiry",
              entityId: state.enquiryId,
              userId: prevContext.enquiryOwnerUserId,
              title: `Call back — client available ${rawTime}`,
              dueDate,
              completed: false,
            },
            systemScope(orgId),
          );
          taskId = created.id;
          console.log(`[sendseven-webhook] Created callback task ${taskId} for enquiry ${state.enquiryId} (conv ${conversationId})`);
        } else {
          console.warn(`[sendseven-webhook] conv ${conversationId} awaiting_availability but missing enquiryId/owner — skipping task creation.`);
        }
        // enquiryStatus is already committed to "scheduled" by the claim above.
        await conversationStateRepository.update(conversationId, {
          needsHuman: true,
          handledByHumanAt: new Date(),
          lastAiReplyAt: new Date(),
          context: { lastReply: confirmReply, availabilityTaskId: taskId, handoffReason: "enquiry_scheduled" },
        });
        await sendReply(orgId, conversationId, message.channel_id, confirmReply, mode, false);
        return;
      }

      // Step: create the enquiry — IMMEDIATELY, on this same turn, once the
      // required core fields are complete (or the ask-cap is hit) — no more
      // grouped follow-up round for whatever optional fields are still
      // missing (those land in the enquiry note via missingBeforeCreate
      // instead). Creation is driven by the COLLECTED DATA, not the model's
      // intent label — the model often flips to intent "other" while closing
      // with "the team will call you", and that must still create the
      // enquiry. `enquiryStatus` here is the status BEFORE this turn (null on
      // a brand-new enquiry that just became complete in one message, or
      // "collecting" if it's been gathered across several turns) — the
      // atomic claim below transitions FROM that value either way, so a
      // retried/concurrent inbound that loses the claim does nothing.
      // (missingBeforeCreate / readyToCreate / substantive computed + logged
      // above.)
      if (readyToCreate) {
        const claimed = await conversationStateRepository.claimStatusTransition(conversationId, enquiryStatus, "awaiting_availability");
        if (!claimed) {
          console.log(`[sendseven-webhook] conv ${conversationId} lost the create-enquiry claim — already actioned, skipping`);
          return;
        }

        console.log(
          `[sendseven-webhook] conv ${conversationId} CREATING enquiry (clientId=${enquiryClientId ?? "null"}) from slotKeys=[${Object.keys(mergedSlots).join(",")}]`,
        );
        const summary = buildEnquirySummary(mergedSlots);
        // enquiryClientId is the traveller for an on-behalf enquiry, else the sender.
        let enquiryId: string | null = null;
        let ownerUserId: string | null = null;
        try {
          const created = await resolveAndCreateEnquiry(orgId, enquiryClientId, mergedSlots, {
            summary,
            missingFields: missingBeforeCreate,
          });
          enquiryId = created.enquiryId;
          ownerUserId = created.ownerUserId;
        } catch (err) {
          // A THROW here (not just a null return) would otherwise escape after the
          // status was already claimed → no enquiry, no reply, silent failure.
          console.error(`[sendseven-webhook] conv ${conversationId} resolveAndCreateEnquiry THREW:`, err);
        }

        if (!enquiryId) {
          // Do NOT report success on a failed create — undo the claimed status
          // and hand off to a human instead of pretending it's logged.
          console.warn(`[sendseven-webhook] org ${orgId} conv ${conversationId} enquiry creation failed after claim (enquiryId=null) — handing off`);
          await conversationStateRepository.update(conversationId, { enquiryStatus: null, enquirySlots: {} });
          return doHandoff("Sorry, I'm having trouble logging that automatically — let me get a colleague to help you.");
        }

        const onBehalfOfName = prevContext.beneficiary?.name;
        const askTimeReply = await generateTransitionReply(botConfig, kb, "ask_callback_time", undefined, onBehalfOfName, { orgId });
        // enquiryStatus is already committed to "awaiting_availability" by the claim above.
        await conversationStateRepository.update(conversationId, {
          intent: "enquiry",
          enquiryId,
          enquirySlots: {},
          needsHuman: false, // AI stays live to ask for a callback time
          lastAiReplyAt: new Date(),
          context: { lastReply: askTimeReply, groupedAskSent: false, enquiryOwnerUserId: ownerUserId ?? undefined, onBehalfOfName },
        });
        console.log(`[sendseven-webhook] Created enquiry ${enquiryId} for org ${orgId} conv ${conversationId} — asking for callback time`);
        await sendReply(orgId, conversationId, message.channel_id, askTimeReply, mode, false);
        return;
      }

      // Step: enquiry intent, still collecting (readyToCreate was false above,
      // so either there's not enough signal yet, or the required core fields
      // are still incomplete and we're under the ask-cap).
      if (treatAsEnquiry) {
        if (!substantive) {
          // Soft anti-empty threshold not met — keep collecting naturally.
          console.log(`[sendseven-webhook] conv ${conversationId} BRANCH=collecting-thin (enquiry, not enough signal yet) — asking naturally`);
          update.intent = "enquiry";
          update.enquiryStatus = "collecting";
          update.enquirySlots = mergedSlots;
          update.context = { ...prevContext, lastReply: turn.reply, askCount: askCount + 1 };
          // Per-message claim (see claimReply/general-route above) — this
          // branch previously sent with no idempotency guard, so a
          // redelivery of the same message would ask the same follow-up
          // question twice.
          if (!(await claimReply(conversationId, orgId, message.id))) return;
          try {
            await sendReply(orgId, conversationId, message.channel_id, turn.reply, mode, false);
          } catch (err) {
            await releaseReplyClaim(message.id);
            throw err;
          }
          await conversationStateRepository.update(conversationId, update);
          return;
        }

        // Required core still incomplete and under the ask-cap — keep
        // collecting naturally with the model's own next question (which,
        // per the prompt, only ever asks about the missing CORE fields —
        // never the nice-to-haves).
        console.log(
          `[sendseven-webhook] conv ${conversationId} BRANCH=collecting-continue coreMissing=[${coreMissing.join("|")}] askCount=${askCount}`,
        );
        update.intent = "enquiry";
        update.enquiryStatus = "collecting";
        update.enquirySlots = mergedSlots;
        update.context = { ...prevContext, lastReply: turn.reply, askCount: askCount + 1 };
        if (!(await claimReply(conversationId, orgId, message.id))) return;
        try {
          await sendReply(orgId, conversationId, message.channel_id, turn.reply, mode, false);
        } catch (err) {
          await releaseReplyClaim(message.id);
          throw err;
        }
        await conversationStateRepository.update(conversationId, update);
        return;
      }

      // Terminal wind-down — breaks the "all set" repeat loop for non-enquiry
      // chatter. If sending would only repeat our last message, or the customer
      // is merely acknowledging, go quiet and hand over.
      if (wouldRepeat || customerAcked) {
        if (!wouldRepeat) {
          await sendReply(orgId, conversationId, message.channel_id, turn.reply, mode, false);
        }
        update.needsHuman = true;
        update.handledByHumanAt = new Date();
        update.context = { ...prevContext, lastReply: turn.reply, handoffReason: "ai_wound_down" };
        console.log(`[sendseven-webhook] conv ${conversationId} wound down (repeat=${wouldRepeat} ack=${customerAcked} status=${enquiryStatus}) — going silent`);
        await conversationStateRepository.update(conversationId, update);
        return;
      }

      // Normal turn: a non-enquiry message — just answer helpfully.
      console.log(`[sendseven-webhook] conv ${conversationId} BRANCH=normal-turn (intent=other, no enquiry signal) — answering, NOT creating`);
      update.intent = "other";
      await sendReply(orgId, conversationId, message.channel_id, turn.reply, mode, false);
      await conversationStateRepository.update(conversationId, update);
    });
  },
};

// Drops generic stand-ins the model may report as a traveller's name ("my
// friend", "your friend", "someone") so we don't create a client literally
// called "friend"/"your friend" — we ask for a real name instead. Catches an
// optional possessive/article determiner (a/my/your/his/her/their/the) plus a
// generic person word. Actual names pass through.
export const GENERIC_TRAVELLER_RE =
  /^(?:(?:a|my|your|his|her|their|the)\s+)?(?:friend|mate|buddy|pal|someone|somebody|colleague|co-?worker|client|customer|person|people|guy|lady|companion|partner|other\s+half)$/i;
export function cleanTravellerName(raw?: string): string | undefined {
  const v = (raw ?? "").trim();
  if (!v || GENERIC_TRAVELLER_RE.test(v)) return undefined;
  return v;
}

// Masks a phone number for logging — keeps only the last 4 digits so the
// state-transition logs stay useful for debugging without dumping a
// customer's raw phone number into the log stream (e.g. "*******1234").
function redactPhone(phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "?";
  const visible = digits.slice(-4);
  return `${"*".repeat(Math.max(digits.length - visible.length, 0))}${visible}`;
}

// Atomically claims the right to send a reply for THIS inbound message on the
// general-route and enquiry-collecting branches — modeled exactly on
// sendsevenWebhookRepository.claimAdminTurn (see that repository for the full
// rationale): SendSeven can redeliver the same message under a DIFFERENT
// event_id, which recordEvent's eventId dedupe doesn't catch, so without this
// a redelivery would send a second, duplicate customer-facing reply. Returns
// true iff the caller should proceed (either it won the claim, or there's no
// message id to claim on — same "proceed without a claim" fallback as the
// admin path). Pair with releaseReplyClaim in a catch around the send itself
// so a genuinely FAILED send doesn't permanently swallow the message.
async function claimReply(conversationId: string, orgId: string, messageId: string | undefined): Promise<boolean> {
  if (!messageId) {
    console.warn(`[sendseven-webhook] conv ${conversationId} reply turn has no message id — proceeding WITHOUT a claim`);
    return true;
  }
  const claimed = await sendsevenWebhookRepository.claimReplyTurn(messageId, orgId);
  if (!claimed) {
    console.log(`[sendseven-webhook] conv ${conversationId} lost the reply-turn claim for message ${messageId} — skipping to avoid a duplicate reply`);
  }
  return claimed;
}

// Releases a reply-turn claim taken by claimReply — call this when the send
// itself throws, so the next redelivery of the same message can re-claim and
// retry instead of the message going permanently unanswered.
async function releaseReplyClaim(messageId: string | undefined): Promise<void> {
  if (!messageId) return;
  await sendsevenWebhookRepository.releaseReplyTurnClaim(messageId);
}

// Sends the AI reply: live to the customer in `send` mode (tagged as ours), or as
// an internal-note draft in `draft` mode. Hand-off lines always go to the customer.
// Records the resulting message id so its message.sent webhook isn't mistaken for
// a human agent's reply (§8).
async function sendReply(
  orgId: string,
  conversationId: string,
  channelId: string | null | undefined,
  reply: string,
  mode: string,
  isHandoff: boolean,
): Promise<void> {
  const text = reply || FALLBACK_REPLY;
  const sent =
    mode === "send" || isHandoff
      ? await messagesRepository.send({
          conversation_id: conversationId,
          channel_id: channelId,
          message_type: "text",
          text,
          meta: AI_META,
        })
      : await messagesRepository.createInternalNote({
          conversation_id: conversationId,
          text: `🤖 Suggested reply:\n\n${text}`,
        });
  if (mode === "send" || isHandoff) {
    void usageService.recordSendsevenSend({ orgId, source: "ai" });
  }
  const sentId = (sent as { id?: string } | null | undefined)?.id;
  if (sentId) await sendsevenWebhookRepository.markOurMessage(sentId, orgId);

  // Best-effort — a bus failure must never break the AI reply itself. Single
  // choke point for AI outbound (both the live send and the draft/internal-note
  // path), so one publish here covers everything reply-worker sends.
  try {
    realtimeService.publish(orgId, { type: "message.sent", conversationId });
  } catch (err) {
    console.warn(`[sendseven-webhook] realtime publish failed for conv ${conversationId}:`, err);
  }
}
