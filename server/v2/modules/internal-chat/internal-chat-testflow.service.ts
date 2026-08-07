import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import {
  buildEnquirySummary,
  buildPhoneConflictReply,
  buildTranscript,
  decideDeterministicRoute,
  effectiveAttachmentKind,
  generateBeneficiaryAsk,
  generateDocumentReceivedAsk,
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
  triageImageAttachments,
  type BeneficiaryAskKind,
} from "../ai-conversation/ai-conversation.brain";
import { classifyConversationRoute } from "../ai-conversation/conversation-router";
import type { AiTurn, EnquirySlots, RetrievedContext, RetrievedMatch, TranscriptMessage } from "../ai-conversation/ai-conversation.types";
import { botConfigRepository } from "../bot-config/bot-config.repository";
import { knowledgeBaseRepository } from "../knowledge-base/knowledge-base.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { adminAgent } from "../sendseven-webhook/admin-agent.service";
import type { PendingAttachment } from "../sendseven-webhook/admin-data.service";
import { resolveDealTurn, type DealRef } from "../sendseven-webhook/deal-context.service";
import { resolveAndCreateEnquiry } from "../sendseven-webhook/enquiry-auto-create.service";
import {
  extractPhoneNumber,
  insertClient,
  resolveOrCreateByDetails,
  samePhoneNumber,
  systemScope,
} from "../sendseven-webhook/identity.service";
import { taskService } from "../task/task.service";
import { createNewTestClient, resolveOrCreateTestClient } from "./internal-chat-identity.service";
import { internalChatRepository } from "./internal-chat.repository";
import type { Scope } from "../../utils/scope";
import type { InternalChatMessage, InternalChatSession } from "@shared/schema";

// Driver for the internal (staff-facing) test flow (Goal B): replays the exact
// SendSeven client-conversation state machine (see reply-worker.service.ts)
// against the internal_chat_session/internal_chat_message tables instead of a
// real SendSeven conversation, using a SYNTHETIC client the tester types in
// themselves. This module intentionally mirrors reply-worker.handleInbound
// branch-for-branch — do not let the two drift silently; if the real flow
// changes, mirror the change here too.

// Transient flags kept on internal_chat_session.context (jsonb), same shape/
// purpose as reply-worker's ConversationContext.
interface ConversationContext {
  lastReply?: string;
  // The real conversation's SendSeven contact/display name — seeded by the
  // fork service (internal-chat-fork.service.ts) so a forked sandbox can
  // address the customer by name even when no CRM client is linked. Unverified;
  // the brain ignores it once a client record is in play.
  contactName?: string;
  // LEGACY — no longer SET by this driver (the enquiry is now created
  // immediately once the core fields complete), only READ for backward
  // compat with a session that started under the old flow. Mirrors
  // reply-worker's ConversationContext — see there for the full comment.
  groupedAskSent?: boolean;
  // Number of collecting-phase questions asked so far this enquiry. Mirrors
  // reply-worker's ConversationContext — see there for the full comment.
  askCount?: number;
  enquiryOwnerUserId?: string;
  availabilityTaskId?: string;
  // For a third-party enquiry: the traveller's name, carried to the
  // awaiting_availability step so the callback confirmation refers to them.
  onBehalfOfName?: string;
  // Which bot the conversation is in — "admin" once an admin-type ask (about
  // the client's own quotes/enquiries/tickets/files) is detected. Mirrors
  // reply-worker's ConversationContext.
  domain?: "sales" | "admin";
  // True once the admin bot has opened a support ticket for this conversation —
  // stops it opening duplicates on later turns.
  ticketOpened?: boolean;
  // Admin loop control — see reply-worker's ConversationContext.
  adminAsked?: boolean;
  adminActionable?: boolean;
  // The tester's own number that clashed with a differently-named client — we've
  // asked them to confirm it. Lets the next turn tell a correction (new number)
  // from a confirmation (same number again). Mirrors reply-worker.
  phoneConflictPhone?: string;
  // Accumulated details read (vision triage) from holiday_info image(s) the
  // tester sent — persisted so they stay in the AI's view on EVERY collecting
  // turn, not just the turn the image arrived (a field the model doesn't
  // extract into slots immediately would otherwise be lost for good). Cleared
  // automatically when the enquiry is created / the session hands off (those
  // branches build a fresh context). Mirrors reply-worker.
  holidayImageInfo?: string;
  // The Facebook-posted deal this test session is about — pinned by the same
  // vector match as the live worker and hydrated live on every sales turn, so
  // the sandbox reproduces the posted-deal reply behaviour (including from a
  // screenshot of the post). Mirrors reply-worker's ConversationContext.
  dealRef?: DealRef;
  // True once the one-time "as posted, or any tweaks?" deal check has been put
  // to the tester. Mirrors reply-worker's ConversationContext.
  dealCheckAsked?: boolean;
  // Sticky "this is a rival's quote" verdict — mirrors reply-worker.
  externalDealMention?: boolean;
  // A DOCUMENT sent BEFORE the tester was identified (mirrors reply-worker's
  // pendingAttachmentRefs): the test chat has no message store to re-download
  // from, so the bytes are held in-process (deferredAttachmentBytes, TTL'd)
  // and this persisted marker carries the filenames + vision description so
  // the identify turn can still route admin, open the ticket, and describe
  // the document even if the process restarted (bytes lost → note says so).
  // Consumed (deleted) on the turn the tester is identified.
  pendingAttachmentInfo?: { filenames: string[]; description?: string };
  // Third-party enquiry ("my friend James wants…") — the enquiry is filed under
  // this traveller, not the sender. Mirrors reply-worker's ConversationContext.
  beneficiary?: {
    name?: string;
    phone?: string;
    clientId?: string;
    phoneConflictPhone?: string;
  };
}

// Drops generic stand-ins the model may report as a traveller's name ("my
// friend", "your friend", "someone") so we don't create a client literally
// called "friend"/"your friend". Mirrors reply-worker's cleanTravellerName.
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
// Mirrors reply-worker's redactPhone.
function redactPhone(phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "?";
  const visible = digits.slice(-4);
  return `${"*".repeat(Math.max(digits.length - visible.length, 0))}${visible}`;
}

const HISTORY_LIMIT = 20;
const FALLBACK_REPLY = "Thanks for your message — one of our advisors will be in touch shortly.";

// In-process holding pen for document bytes sent BEFORE the tester was
// identified (see ConversationContext.pendingAttachmentInfo). Keyed by
// session id; TTL'd so an abandoned test session doesn't pin buffers. This is
// deliberately process-local — the test chat is a single-server dev tool, and
// a restart merely means the eventual ticket lacks the file (the persisted
// marker still carries the vision description).
const DEFERRED_BYTES_TTL_MS = 60 * 60 * 1000;
const deferredAttachmentBytes = new Map<string, { attachments: PendingAttachment[]; storedAt: number }>();

function pruneDeferredBytes(): void {
  const cutoff = Date.now() - DEFERRED_BYTES_TTL_MS;
  for (const [key, entry] of deferredAttachmentBytes) {
    if (entry.storedAt < cutoff) deferredAttachmentBytes.delete(key);
  }
}

function stashDeferredAttachmentBytes(sessionId: string, attachments: PendingAttachment[]): void {
  pruneDeferredBytes();
  const existing = deferredAttachmentBytes.get(sessionId);
  deferredAttachmentBytes.set(sessionId, {
    attachments: [...(existing?.attachments ?? []), ...attachments],
    storedAt: Date.now(),
  });
}

function takeDeferredAttachmentBytes(sessionId: string): PendingAttachment[] {
  pruneDeferredBytes();
  const entry = deferredAttachmentBytes.get(sessionId);
  deferredAttachmentBytes.delete(sessionId);
  return entry?.attachments ?? [];
}

export interface RunTestFlowTurnResult {
  replyMessage: InternalChatMessage;
}

// internal_chat_message has no `direction` column — map role -> the
// inbound/outbound shape ai-conversation.brain's buildTranscript expects.
// system_note rows are internal-only annotations, not conversation turns, so
// they're excluded from the transcript entirely.
function toTranscriptMessages(messages: InternalChatMessage[]): TranscriptMessage[] {
  return messages
    .filter((m) => m.role !== "system_note")
    .map((m) => ({
      direction: m.role === "assistant" ? "outbound" : "inbound",
      text: m.content,
      created_at: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    }));
}

export const internalChatTestflowService = {
  // Handles one staff-driven test turn: identity resolution -> AI turn ->
  // enquiry slot-filling / reply, replaying reply-worker's state machine
  // against the internal_chat tables. Always persists and returns an
  // assistant message (unlike reply-worker, this transport has no
  // draft-vs-send distinction and no silent no-op branch — the tester is
  // watching a live chat, so every turn gets a reply).
  async runTestFlowTurn(
    session: InternalChatSession,
    userText: string,
    scope: Scope,
    // Optional file(s) the tester "sent" with this message — lets the test
    // flow exercise the real attachment path (vision read → admin route →
    // ticket with the file + AI-read description), mirroring reply-worker.
    // Bytes exist only for THIS turn: unlike the SendSeven flow there is no
    // message store to re-download from, so the test flow has NO pre-
    // onboarding deferral — send attachments on a turn where the tester is
    // already identified (or identifies themselves in the same message).
    attachments?: PendingAttachment[],
  ): Promise<RunTestFlowTurnResult> {
    const orgId = session.orgId;
    const pendingAttachments = attachments ?? [];

    const persistReply = (text: string): Promise<InternalChatMessage> =>
      internalChatRepository.createMessage({ sessionId: session.id, role: "assistant", content: text || FALLBACK_REPLY });

    const doHandoff = async (prevContext: ConversationContext, reply: string): Promise<InternalChatMessage> => {
      await internalChatRepository.updateSession(session.id, orgId, {
        needsHuman: true,
        context: { ...prevContext, lastReply: reply },
      });
      return persistReply(reply);
    };

    await internalChatRepository.createMessage({ sessionId: session.id, role: "user", content: userText });

    // Already handed off (a prior turn logged an enquiry / hit a hand-off) —
    // the tester is expected to start a fresh session to run the flow again,
    // rather than the AI silently re-engaging after an idle timeout like the
    // real SendSeven worker does.
    if (session.needsHuman) {
      const replyMessage = await persistReply(
        "This test session has already completed (handed to a human / logged an enquiry). Start a new test session to run the flow again.",
      );
      return { replyMessage };
    }

    let clientId = session.clientId;
    const knownClient = !!clientId;

    // The user message is already inserted above, so there's no data
    // dependency between the recent-message fetch and botConfig/kb/existingClient
    // — fold it into the same parallel batch instead of awaiting it separately.
    const [botConfig, kb, existingClient, recent] = await Promise.all([
      botConfigRepository.findByOrg(orgId),
      knowledgeBaseRepository.list(orgId),
      clientId ? neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null) : Promise.resolve(null),
      internalChatRepository.getRecentMessages(session.id, orgId, HISTORY_LIMIT),
    ]);
    const transcript = buildTranscript(toTranscriptMessages(recent), userText);

    // A test session can, in principle, run several enquiries end to end — once
    // one is fully wrapped (scheduled), start the next from a clean slate. In
    // practice this session will already have needsHuman=true by then and be
    // caught by the check above, but this mirrors reply-worker's guard exactly.
    const isFreshEnquiry = session.enquiryStatus === "created" || session.enquiryStatus === "scheduled";
    const enquiryStatus = isFreshEnquiry ? null : session.enquiryStatus;
    const priorSlots: EnquirySlots = isFreshEnquiry ? {} : ((session.enquirySlots as EnquirySlots) ?? {});
    const prevContext = (session.context as ConversationContext | null) ?? {};
    // Computed once and reused below (deterministic route precedence) instead of
    // calling looksLikeAdminAsk(userText) a second time for the same turn.
    const isAdminAsk = looksLikeAdminAsk(userText);
    // Carry admin intent across the onboarding detour (see reply-worker) — the
    // completion turn's literal message is just a phone number, so its own route
    // classification is unreliable.
    const sawAdminIntent = prevContext.domain === "admin" || isAdminAsk;

    // ── Upper-level ROUTER (mirrors reply-worker) ──────────────────────────
    // Decide which bot handles this turn BEFORE running any of them — computed
    // up here, BEFORE the onboarding gate, so a bare greeting or general
    // question goes straight to the general route instead of being forced
    // through name+phone collection. The enquiry bot's large prompt is
    // untouched — routing lives in conversation-router.ts.
    // An enquiry is "in flight" — and must stay on the SALES bot, never be pulled
    // into admin — once ANY of these hold: we're mid state-machine (collecting /
    // awaiting_availability), a grouped ask was sent, we've already captured real
    // holiday detail, or we're collecting a third-party (beneficiary) enquiry.
    // Broadened (2026-07-17) because the router was mis-classifying mid-enquiry
    // replies (a name+phone, a callback time) as admin, which then opened a
    // ticket instead of logging the enquiry — and admin stuck via context.domain.
    // Computed once and reused below (the ROUTE log line and the sales-bot
    // retrieval gate `enquiryish`) instead of re-running the same check on the
    // same (immutable) priorSlots up to three times per turn.
    const priorSubstantive = hasSubstantiveSignal(priorSlots);
    const enquiryInFlight =
      enquiryStatus === "collecting" ||
      enquiryStatus === "awaiting_availability" ||
      !!prevContext.groupedAskSent ||
      !!prevContext.beneficiary ||
      priorSubstantive;

    // ── Image triage (mirrors reply-worker) ────────────────────────────────
    // Classify + read any image(s) sent this turn BEFORE routing: a DOCUMENT
    // (passport, booking paperwork…) forces the admin/ticket path exactly as
    // before; a HOLIDAY_INFO image (a deal/advert/offer screenshot) is a
    // SALES signal — its extracted details are injected into the transcript
    // the AI sees, treated as stated by the customer, so the enquiry bot
    // fills slots from them and only asks for what's still missing. A null
    // triage (vision failed) falls back to the document default (fail-safe).
    const imageTriage = pendingAttachments.length
      ? await triageImageAttachments(pendingAttachments, { orgId, feature: "staff_chat_test", userId: scope.userId ?? undefined })
      : null;
    // Accumulate holiday-image details in the context (containment-deduped,
    // capped) so they persist across the WHOLE collecting flow — the model
    // gets every chance to extract each field, not just one turn. Mutating
    // prevContext means every later context persist carries it; the
    // create/hand-off branches build fresh contexts, clearing it.
    if (imageTriage?.kind === "holiday_info") {
      const existing = prevContext.holidayImageInfo ?? "";
      if (!existing.includes(imageTriage.description.slice(0, 120))) {
        prevContext.holidayImageInfo = `${existing} ${imageTriage.description}`.trim().slice(0, 1500);
      }
    }
    const imageInfoNote = prevContext.holidayImageInfo
      ? `[Details from the image(s) I've sent in this chat — treat these as details I've stated: ${prevContext.holidayImageInfo}]`
      : null;
    // Defer a pre-identification DOCUMENT upload (mirrors reply-worker's
    // pendingAttachmentRefs): bytes go to the in-process holding pen, the
    // marker (filenames + vision description) is persisted on the session
    // context — the identify turn consumes both into the ticket.
    const currentEffectiveKind = pendingAttachments.length ? effectiveAttachmentKind(imageTriage?.kind ?? null, userText) : null;
    if (!clientId && pendingAttachments.length && currentEffectiveKind === "document") {
      stashDeferredAttachmentBytes(session.id, pendingAttachments);
      const priorInfo = prevContext.pendingAttachmentInfo;
      const description =
        [priorInfo?.description, imageTriage?.kind !== "holiday_info" ? imageTriage?.description : undefined]
          .filter(Boolean)
          .join(" ")
          .slice(0, 800) || undefined;
      prevContext.pendingAttachmentInfo = {
        filenames: [...(priorInfo?.filenames ?? []), ...pendingAttachments.map((a) => a.filename)],
        description,
      };
      console.log(`[internal-chat-testflow] session ${session.id} deferring ${pendingAttachments.length} document attachment(s) until the tester is identified`);
    }
    // What the LLMs read. The stored transcript keeps only the typed text —
    // the image details ride along via the note; anything worth keeping lands
    // in the extracted slots, which are persisted. A document attachment gets
    // its own line so the (pre-identification) onboarding turn KNOWS a file
    // arrived and acknowledges it while asking for name+phone, instead of
    // replying as if the message were empty chat.
    const documentAttachmentLine =
      currentEffectiveKind === "document"
        ? `Customer: [I've attached ${pendingAttachments.length === 1 ? "a file" : "files"}: ${pendingAttachments.map((a) => a.filename).join(", ")}]`
        : null;
    const transcriptForAi = [transcript, imageInfoNote ? `Customer: ${imageInfoNote}` : null, documentAttachmentLine]
      .filter(Boolean)
      .join("\n");
    // (3.2, mirrors reply-worker) A deterministic ACTIONABLE admin signal on THIS
    // turn breaks OUT of enquiryInFlight stickiness — a customer mid-enquiry who
    // complains about an existing booking must reach the admin bot, not be
    // funneled into holiday slot-filling. A merely admin-ish but NON-actionable
    // question does NOT break out — stays sales-sticky exactly as before.
    // (3.2, mirrors reply-worker) Deterministic route precedence, shared via
    // decideDeterministicRoute. An attachment on this turn (a document being
    // submitted) forces admin, exactly like the SendSeven flow.
    const deterministicRoute = decideDeterministicRoute({
      enquiryInFlight,
      hasAttachments: pendingAttachments.length > 0,
      // holidayImageInfo persisting from a PRIOR turn keeps the conversation
      // deterministically on SALES for the whole collecting flow (mirrors
      // reply-worker) — a follow-up like "october 2nd" must not fall to the
      // classifier, which can misread "other dates for this deal" as an
      // amendment → admin → a spurious ticket. Documents and deterministic
      // admin signals still take precedence in decideDeterministicRoute.
      // effectiveAttachmentKind: null triage → document (fail-safe); triage
      // "other" but the tester SAYS it's a document ("heres my passport") →
      // the customer's words win — vision can misjudge real-world photos.
      // A deferred pre-identification document (pendingAttachmentInfo) keeps
      // later, attachment-less turns on the admin route until consumed.
      attachmentKind: pendingAttachments.length
        ? currentEffectiveKind
        : prevContext.pendingAttachmentInfo
          ? "document"
          : prevContext.holidayImageInfo
            ? "holiday_info"
            : null,
      actionable: looksLikeActionableAdmin(userText),
      adminAsk: isAdminAsk,
    });
    const complaintBreaksOutOfEnquiry = enquiryInFlight && deterministicRoute === "admin";
    // Do NOT force admin purely because a PRIOR turn set domain="admin" (sticky).
    // A single router misfire would otherwise trap the whole conversation in
    // admin and open a ticket instead of logging a sales enquiry. Only a
    // DETERMINISTIC admin ask forces admin; otherwise the classifier decides,
    // with the prior domain passed as a sticky HINT so genuine admin follow-ups
    // still stay admin but a clear new-holiday message can recover to sales.
    const route: "sales" | "admin" | "general" =
      deterministicRoute !== "classify"
        ? deterministicRoute
        : await classifyConversationRoute({
            transcript: transcriptForAi,
            latestText: userText,
            enquiryInFlight,
            priorDomainAdmin: prevContext.domain === "admin",
            orgId,
            feature: "staff_chat_test",
            userId: scope.userId ?? undefined,
          });
    console.log(
      `[internal-chat-testflow] session=${session.id} ROUTE=${route} enquiryInFlight=${enquiryInFlight} ` +
        `complaintBreakout=${complaintBreaksOutOfEnquiry} status=${enquiryStatus} groupedAskSent=${!!prevContext.groupedAskSent} ` +
        `beneficiary=${!!prevContext.beneficiary} sawAdminIntent=${sawAdminIntent} domain=${prevContext.domain ?? "none"} priorSubstantive=${priorSubstantive}`,
    );

    // ── General route ────────────────────────────────────────────────────
    // No booking or admin intent — just converse normally. No identity is
    // needed, so this skips both the onboarding gate and the enquiry bot's
    // slot-filling entirely.
    if (route === "general") {
      const reply = await generateGeneralReply(
        botConfig,
        kb,
        transcript,
        existingClient,
        { orgId, feature: "staff_chat_test", userId: scope.userId ?? undefined },
        prevContext.contactName,
      );
      await internalChatRepository.updateSession(session.id, orgId, {
        intent: "other",
        context: { ...prevContext, lastReply: reply },
      });
      const replyMessage = await persistReply(reply);
      return { replyMessage };
    }

    // Vector retrieval (best-effort): KB always (when the static KB exceeds
    // the prompt budget), past quotes only for enquiry-ish turns. Computed up
    // here — BEFORE the onboarding gate — so the onboarding generateTurn call
    // gets the same retrieved context as the sales call, and so a turn that
    // completes onboarding can reuse that one call instead of running
    // generateTurn twice. Mirrors reply-worker.
    let retrieved: RetrievedContext = { kb: [], quotes: [] };
    if (route === "sales") {
      const enquiryish =
        enquiryStatus === "collecting" || enquiryStatus === "awaiting_availability" || priorSubstantive;
      const kbOverflow = kbExceedsBudget(kb);
      // Last two tester messages + image details — also fed verbatim to
      // pickDealMatch's title rescue. Mirrors reply-worker's dealQuery.
      const dealQuery = !prevContext.dealRef
        ? [
            [...recent]
              .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
              .filter((m) => m.role === "user" && m.content?.trim())
              .map((m) => m.content.trim())
              // The current message was already inserted before the recent
              // fetch — drop it, keep the one before.
              .slice(0, -1)
              .pop() ?? "",
            userText,
            imageInfoNote ?? "",
          ]
            .filter(Boolean)
            .join(" ")
        : "";
      const [kbMatches, quoteMatches, dealTurn] = await Promise.all([
        kbOverflow
          ? aiEmbeddingsService.retrieve({ orgId, sourceType: "knowledge", query: imageInfoNote ? `${userText} ${imageInfoNote}` : userText, limit: 3, audience: "sales" })
          : Promise.resolve([] as RetrievedMatch[]),
        enquiryish
          ? aiEmbeddingsService.retrieve({ orgId, sourceType: "quote", query: `${imageInfoNote ? `${userText} ${imageInfoNote}` : userText} ${JSON.stringify(priorSlots)}`, limit: 4 })
          : Promise.resolve([] as RetrievedMatch[]),
        // Posted-deal detection — the ENTIRE step (retrieval while unpinned,
        // title/field/distance pinning, candidates, hydration, tweak flag,
        // slot seeding — mutates priorSlots) is resolveDealTurn, SHARED with
        // reply-worker so the sandbox and the live bot cannot drift.
        resolveDealTurn({
          orgId,
          logLabel: `session=${session.id}`,
          existingRef: prevContext.dealRef,
          checkAsked: prevContext.dealCheckAsked,
          externalSticky: prevContext.externalDealMention,
          query: dealQuery,
          slots: priorSlots,
        }),
      ]);
      // Mutation → persisted by every later context spread. A corrected pin
      // re-arms the one-time check. Mirrors reply-worker.
      if (dealTurn.pinnedNow) prevContext.dealRef = dealTurn.pinnedNow;
      if (dealTurn.repinned) delete prevContext.dealCheckAsked;
      if (dealTurn.externalDealMention) prevContext.externalDealMention = true;
      retrieved = {
        kb: kbMatches,
        quotes: quoteMatches,
        deal: dealTurn.deal,
        dealCandidates: dealTurn.dealCandidates,
        externalDealMention: dealTurn.externalDealMention,
      };
    }

    // When onboarding completes in this same message, its turn is reused by
    // the sales section below instead of calling generateTurn a second time
    // with the resolved client. Mirrors reply-worker's firstTurn reuse.
    let firstTurn: AiTurn | null = null;

    // Client onboarding gate: for an unknown synthetic contact, collect full
    // name + phone ONLY (no email), then create/reuse the test client and
    // fall through to process the enquiry turn in the same call.
    if (!knownClient) {
      const onboard = await generateTurn(
        botConfig,
        kb,
        null,
        transcriptForAi,
        enquiryStatus,
        priorSlots,
        false,
        retrieved,
        { orgId, feature: "staff_chat_test", userId: scope.userId ?? undefined },
        prevContext.contactName,
      );
      console.log(
        `[internal-chat-testflow] session=${session.id} onboarding (unknown contact) handoff=${onboard.hand_off} ` +
          `hasName=${!!onboard.client?.fullName} hasPhone=${!!onboard.client?.phone} onBehalf=${!!onboard.beneficiary?.onBehalf}`,
      );
      // Third-party enquiry ("my friend James wants to book…") — the enquiry
      // belongs to the traveller, not the sender, so do NOT onboard the sender.
      // Seed the beneficiary context and fall through to the sales flow, which
      // collects the traveller's phone and files the enquiry under them.
      const beneficiaryEnquiry = !!prevContext.beneficiary || !!onboard.beneficiary?.onBehalf;
      if (beneficiaryEnquiry && !prevContext.beneficiary) {
        prevContext.beneficiary = { name: cleanTravellerName(onboard.beneficiary?.fullName) };
      }
      if (!beneficiaryEnquiry) {
        // An admin matter (complaint, document, account query) — recognised by the
        // ROUTE (the classifier catches complaints like "my room is filthy" that
        // the keyword check misses) or the deterministic admin signal. Don't hand
        // off during onboarding for these: collect name+phone, then the admin bot
        // opens a ticket once they're identified. Only a NON-admin hand_off hands off.
        const adminMatter = route === "admin" || sawAdminIntent;
        if (onboard.hand_off && !adminMatter) {
          const replyMessage = await doHandoff(prevContext, onboard.reply);
          return { replyMessage };
        }

        const full = onboard.client?.fullName?.trim();
        const phone = onboard.client?.phone?.trim();
        if (!(full && phone)) {
          // Persist the admin intent (domain) so it survives to the completion turn,
          // plus whether it's an actionable complaint/submission stated now (e.g.
          // "my room is filthy") so it isn't lost on the name/phone turns.
          if (adminMatter) {
            await internalChatRepository.updateSession(session.id, orgId, {
              context: {
                ...prevContext,
                domain: "admin",
                adminActionable: prevContext.adminActionable || looksLikeActionableAdmin(userText),
              },
            });
          } else if (prevContext.holidayImageInfo) {
            // A deal-image's details must survive the onboarding detour even
            // though this isn't an admin matter — persist the context so the
            // completion turn still has them in view.
            await internalChatRepository.updateSession(session.id, orgId, { context: { ...prevContext } });
          }
          // A document sent on THIS pre-identification turn: reply
          // deterministically (confirm receipt + ask name/phone) — the
          // general onboarding turn can't be trusted with attachments (it
          // tends to deny being able to "view" them).
          const reply =
            currentEffectiveKind === "document"
              ? await generateDocumentReceivedAsk(botConfig, kb, { orgId, feature: "staff_chat_test", userId: scope.userId ?? undefined })
              : onboard.reply;
          const replyMessage = await persistReply(reply);
          return { replyMessage };
        }

        // Phone ↔ name allocation (mirrors reply-worker). If the number is already
        // on file under a DIFFERENT client's name we asked them to confirm it last
        // turn (phoneConflictPhone). Standing by the SAME number = confirmation
        // it's genuinely theirs → register a NEW client under the name they gave,
        // never fold them into the other client's record. A different number means
        // they corrected it → re-resolve below.
        const pendingConflictPhone = prevContext.phoneConflictPhone;
        if (pendingConflictPhone && samePhoneNumber(pendingConflictPhone, phone)) {
          clientId = await createNewTestClient(orgId, scope.userId, { fullName: full, phone });
          delete prevContext.phoneConflictPhone;
          await internalChatRepository.updateSession(session.id, orgId, { clientId, context: { ...prevContext } });
          console.log(`[internal-chat-testflow] session ${session.id} phone confirmed after clash — created new client ${clientId}`);
        } else {
          const resolution = await resolveOrCreateTestClient(orgId, scope.userId, { fullName: full, phone });
          if (resolution.status === "phone_conflict") {
            const confirmReply = buildPhoneConflictReply();
            await internalChatRepository.updateSession(session.id, orgId, {
              context: {
                ...prevContext,
                ...(adminMatter ? { domain: "admin" as const } : {}),
                lastReply: confirmReply,
                phoneConflictPhone: phone,
              },
            });
            console.log(
              `[internal-chat-testflow] session ${session.id} phone clash — number belongs to ${resolution.existingNames.length} existing client(s); asked to confirm`,
            );
            const replyMessage = await persistReply(confirmReply);
            return { replyMessage };
          }
          clientId = resolution.clientId;
          delete prevContext.phoneConflictPhone;
          await internalChatRepository.updateSession(session.id, orgId, { clientId, context: { ...prevContext } });
          console.log(`[internal-chat-testflow] session ${session.id} linked client ${clientId} (collected details)`);
        }
        // Onboarding resolved name+phone with no early return — the sales
        // section below reuses this turn's reply/slots/intent instead of
        // calling generateTurn again (mirrors reply-worker).
        firstTurn = onboard;
      }
    }

    const clientRecord = knownClient
      ? existingClient
      : clientId
        ? await neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null)
        : null;

    // `route` was already decided above (before onboarding).

    // ── Attachment note + deferred-document consume (mirrors reply-worker) ──
    // Built from the triage that already ran above (one vision call per turn).
    // A HOLIDAY_INFO image is NOT a document submission — its details were
    // injected into transcriptForAi for the sales bot instead, so no note (and
    // no ticket instruction) is built for it. A null triage (vision failed)
    // keeps the pre-vision wording — the attachment is still ticketed.
    //
    // Once the tester is identified, any document deferred from a PRE-
    // identification turn is consumed here: its bytes (if the process hasn't
    // restarted) join the ticket attachments, its stored vision description
    // joins the note, and the marker is deleted (later context persists drop
    // it). Deferred files arrived first, so they're prepended.
    let ticketAttachments = pendingAttachments;
    let deferredDescription: string | undefined;
    let deferredFilenames: string[] = [];
    if (clientId && prevContext.pendingAttachmentInfo) {
      const stashedBytes = takeDeferredAttachmentBytes(session.id);
      if (stashedBytes.length) ticketAttachments = [...stashedBytes, ...pendingAttachments];
      deferredDescription = prevContext.pendingAttachmentInfo.description;
      deferredFilenames = prevContext.pendingAttachmentInfo.filenames;
      delete prevContext.pendingAttachmentInfo;
      console.log(
        `[internal-chat-testflow] session ${session.id} consumed deferred document(s): ${deferredFilenames.join(", ")} (bytes ${stashedBytes.length ? "recovered" : "NOT recovered — process restarted?"})`,
      );
    }
    const noteFilenames = [...deferredFilenames.filter((f) => !pendingAttachments.some((a) => a.filename === f)), ...pendingAttachments.map((a) => a.filename)];
    const imageDescription =
      [deferredDescription, imageTriage && imageTriage.kind !== "holiday_info" ? imageTriage.description : undefined]
        .filter(Boolean)
        .join(" ") || null;
    const attachmentNote =
      noteFilenames.length && currentEffectiveKind !== "holiday_info"
        ? `The customer has sent the following file(s) in this conversation: ${noteFilenames.join(", ")}. ` +
          (imageDescription
            ? `AI-read summary of the image(s), UNVERIFIED — a colleague must still review the actual file(s): ${imageDescription} ` +
              "Include these AI-read details in the ticket description so staff have context. "
            : "") +
          "Treat this as a document submission: use open_ticket to log it for a colleague — " +
          (ticketAttachments.length
            ? "the file(s) will be attached to that ticket automatically. "
            : "NOTE: the original file could not be carried over, so ask the customer to resend it if staff will need it, and say so in the ticket description. ") +
          "Then confirm to the customer you've received and logged it. Do NOT claim to have checked or verified the document yourself."
        : undefined;

    // ── Admin bot ──────────────────────────────────────────────────────────
    // Fail-closed on clientId. Answers from the client's OWN records.
    if (route === "admin" && clientId) {
      // Mirrors reply-worker's atomic claim (claimAdminTurn) before a turn that
      // may open a ticket. A test session has no real SendSeven redelivery —
      // turns run one at a time, driven synchronously by a single staff tester —
      // so there's no duplicate-ticket race to guard here; no claim is taken.

      // Actionable = complaint / details submission (needs a ticket) vs a
      // read-only records query. `shouldForceTicketNow` (mirrors reply-worker)
      // requires we already asked without opening a ticket (adminAsked) AND the
      // CURRENT turn carries signal — either it's itself deterministically
      // actionable, or a substantive (non-acknowledgement) reply to that
      // clarifying question. `adminActionable` below is a STICKY flag persisted
      // for logging/observability only — it is NOT read by the force gate,
      // since once true it never clears.
      const adminActionable = !!prevContext.adminActionable || looksLikeActionableAdmin(userText) || !!attachmentNote;
      const forceTicketNow = shouldForceTicketNow({
        adminAsked: prevContext.adminAsked,
        ticketOpened: prevContext.ticketOpened,
        latestText: userText,
        hasAttachment: !!attachmentNote,
      });
      console.log(
        `[internal-chat-testflow] session=${session.id} route=admin actionable=${adminActionable} attachments=${!!attachmentNote} ` +
          `adminAsked=${!!prevContext.adminAsked} forceTicket=${forceTicketNow} -> admin agent`,
      );
      const adminResult = await adminAgent.answer(
        orgId,
        clientId,
        botConfig,
        kb,
        transcript,
        clientRecord,
        attachmentNote,
        ticketAttachments,
        !!prevContext.ticketOpened,
        forceTicketNow,
      );
      if (adminResult) {
        const ticketOpenedNow = prevContext.ticketOpened || adminResult.ticketOpened;
        await internalChatRepository.updateSession(session.id, orgId, {
          intent: "other",
          context: {
            ...prevContext,
            lastReply: adminResult.reply,
            domain: "admin",
            ticketOpened: ticketOpenedNow,
            adminActionable,
            adminAsked: prevContext.adminAsked || !ticketOpenedNow,
          },
        });
        const replyMessage = await persistReply(adminResult.reply);
        return { replyMessage };
      }
      // Admin agent failed hard — hand off cleanly.
      const replyMessage = await doHandoff(prevContext, "Let me get a colleague to help you with that.");
      return { replyMessage };
    }

    // ── Sales / enquiry bot (UNCHANGED flow) ───────────────────────────────
    // Retrieval was computed above (before the onboarding gate). When this
    // same message completed onboarding, reuse that turn instead of a second
    // generateTurn call — mirrors reply-worker.
    const turn =
      firstTurn ??
      (await generateTurn(
        botConfig,
        kb,
        clientRecord,
        transcriptForAi,
        enquiryStatus,
        priorSlots,
        true,
        retrieved,
        { orgId, feature: "staff_chat_test", userId: scope.userId ?? undefined },
        prevContext.contactName,
      ));

    // Consume the one-time deal check only on a REAL sales turn — `firstTurn`
    // means we're reusing the onboarding turn, whose prompt defers the check
    // to the next reply. Mirrors reply-worker.
    if (retrieved.deal?.tweakCheckPending && !firstTurn) prevContext.dealCheckAsked = true;

    if (turn.hand_off) {
      const replyMessage = await doHandoff(prevContext, turn.reply);
      return { replyMessage };
    }

    const customerAcked = isAcknowledgement(userText.trim());
    const lastReply = prevContext.lastReply ?? "";
    const wouldRepeat = similarReply(turn.reply, lastReply);
    const mergedSlots = mergeSlots(priorSlots, turn.slots);

    // Deterministic holidayType backstop (mirrors reply-worker): the model's
    // slot extraction is unreliable turn-to-turn (it can return empty slots
    // even when "cruise" is plainly in the transcript), so if holidayType
    // still hasn't landed, recover it deterministically from the full
    // transcript rather than silently falling through to the Package Holiday
    // default at creation.
    if (!mergedSlots.holidayType) {
      const inferred = inferHolidayTypeFromText(transcriptForAi);
      if (inferred) mergedSlots.holidayType = inferred;
    }

    // ── Third-party enquiry ("on behalf of a friend") ──────────────────────
    // Mirrors reply-worker: the enquiry belongs to the named traveller, not the
    // sender. Resolve/collect the traveller (robust phone capture) FIRST, then
    // file the enquiry under them. Defaults to the sender's client id.
    let enquiryClientId = clientId;
    const benTurn = turn.beneficiary;
    const benCtx = prevContext.beneficiary;
    const beneficiaryActive = !!benCtx || !!benTurn?.onBehalf;
    if (beneficiaryActive && enquiryStatus !== "awaiting_availability") {
      const travellerName = cleanTravellerName(benTurn?.fullName) || benCtx?.name;
      let benClientId = benCtx?.clientId;
      // Only TRUST the free-text phone extraction while we're actually in the
      // phone-collection step (the traveller isn't resolved yet) — mirrors
      // reply-worker so a later, unrelated large number can't overwrite/
      // misresolve an already-resolved traveller's phone.
      const travellerPhone =
        (
          benTurn?.phone?.trim() ||
          (!benClientId ? extractPhoneNumber(userText) : null) ||
          benCtx?.phone ||
          ""
        ).trim() || undefined;

      if (!benClientId) {
        if (!travellerName || !travellerPhone) {
          // Need the traveller's NAME and/or phone before logging under them —
          // ask for exactly what's missing, never invent a placeholder name.
          // (3.3, mirrors reply-worker) Generated in the org's voice/language via
          // the brain, falling back to the fixed English line on any failure.
          const askKind: BeneficiaryAskKind = !travellerName && !travellerPhone ? "name_and_phone" : !travellerName ? "name" : "phone";
          const ask = await generateBeneficiaryAsk(botConfig, kb, askKind, travellerName, {
            orgId,
            feature: "staff_chat_test",
            userId: scope.userId ?? undefined,
          });
          await internalChatRepository.updateSession(session.id, orgId, {
            intent: "enquiry",
            enquiryStatus: "collecting",
            enquirySlots: mergedSlots,
            context: { ...prevContext, lastReply: ask, beneficiary: { name: travellerName, phone: travellerPhone } },
          });
          console.log(`[internal-chat-testflow] session ${session.id} on-behalf enquiry — asking for traveller name/phone (name=${travellerName ?? "?"} phone=${redactPhone(travellerPhone)})`);
          const replyMessage = await persistReply(ask);
          return { replyMessage };
        }

        // Have a real name + phone → resolve/create the traveller. A transient
        // DB failure here must not fall through as a silent no-reply turn —
        // hand off instead, mirroring the enquiry-create hardening below.
        try {
          const pendingBenConflict = benCtx?.phoneConflictPhone;
          if (pendingBenConflict && samePhoneNumber(pendingBenConflict, travellerPhone)) {
            benClientId = await insertClient(orgId, { fullName: travellerName, phone: travellerPhone });
          } else {
            const resolution = await resolveOrCreateByDetails(orgId, { fullName: travellerName, phone: travellerPhone });
            if (resolution.status === "phone_conflict") {
              const confirmReply = buildPhoneConflictReply(travellerName);
              await internalChatRepository.updateSession(session.id, orgId, {
                intent: "enquiry",
                enquiryStatus: "collecting",
                enquirySlots: mergedSlots,
                context: {
                  ...prevContext,
                  lastReply: confirmReply,
                  beneficiary: { name: travellerName, phone: travellerPhone, phoneConflictPhone: travellerPhone },
                },
              });
              console.log(`[internal-chat-testflow] session ${session.id} beneficiary phone clash — number belongs to ${resolution.existingNames.length} existing client(s); asked to confirm`);
              const replyMessage = await persistReply(confirmReply);
              return { replyMessage };
            }
            benClientId = resolution.clientId;
          }
        } catch (err) {
          console.error(`[internal-chat-testflow] session ${session.id} beneficiary resolve/insert THREW:`, err);
          const replyMessage = await doHandoff(prevContext, "Sorry, I'm having trouble setting that up right now — let me get a colleague to help you.");
          return { replyMessage };
        }
        console.log(`[internal-chat-testflow] session ${session.id} on-behalf enquiry — traveller client ${benClientId} (${travellerName})`);
      }

      enquiryClientId = benClientId ?? clientId;
      prevContext.beneficiary = { name: travellerName, phone: travellerPhone, clientId: benClientId };
    }

    // Enquiry-ness + create trigger, computed up here so we can log the whole
    // decision in one place. Driven by COLLECTED DATA, not the model's intent
    // label (it routinely flips to "other" while closing with "the team will
    // call you", which must NOT drop the enquiry). Mirrors reply-worker.
    const substantive = hasSubstantiveSignal(mergedSlots);
    const treatAsEnquiry = turn.intent === "enquiry" || substantive || beneficiaryActive;

    // "Additional fields still needed" (ALL fields, incl. nice-to-haves) — no
    // longer a create gate; only used for the note on enquiry creation (and
    // for observability in the log line below). Mirrors reply-worker.
    const missingBeforeCreate = missingFieldsFor(mergedSlots);

    // Required-CORE gate: while any of these are missing (and the ask-cap
    // hasn't been hit), keep collecting naturally instead of creating. Logs
    // slot KEYS only (never the raw values — destination/notes/etc. can carry
    // customer PII) so this stays useful for debugging state transitions
    // without dumping personal data into the log stream. Mirrors reply-worker.
    // A pinned deal drops budget from the core set (its price is published) —
    // mirrors reply-worker.
    const coreMissing = missingCoreFieldsFor(mergedSlots, { dealPinned: !!retrieved.deal });
    const askCount = prevContext.askCount ?? 0;

    // Create trigger — fires on THIS SAME TURN once we're treating this as an
    // enquiry with real signal AND either the required core fields are
    // complete, the ask-cap has been reached, or this conversation already
    // sent the (now-legacy) grouped ask on a prior turn. See
    // shouldCreateEnquiryNow. Mirrors reply-worker.
    const readyToCreate =
      treatAsEnquiry &&
      substantive &&
      shouldCreateEnquiryNow({
        coreMissingCount: coreMissing.length,
        askCount,
        groupedAskSentLegacy: !!prevContext.groupedAskSent,
        // Mirrors reply-worker: the model's completion signal covers declined
        // core fields whose slots legitimately stay empty.
        modelSaysComplete: !!turn.complete,
      });

    console.log(
      `[internal-chat-testflow] session=${session.id} ENQUIRY-DECISION route=${route} intent=${turn.intent} ` +
        `status=${enquiryStatus} groupedAskSentLegacy=${!!prevContext.groupedAskSent} substantive=${substantive} ` +
        `treatAsEnquiry=${treatAsEnquiry} missing=${missingBeforeCreate.length}[${missingBeforeCreate.join("|")}] ` +
        `readyToCreate=${readyToCreate} beneficiary=${beneficiaryActive} enquiryClientId=${enquiryClientId ?? "null"} ` +
        `coreMissing=${coreMissing.length} askCount=${askCount} modelComplete=${!!turn.complete} ` +
        `mergedSlotKeys=[${Object.keys(mergedSlots).join(",")}] rawTurnSlotKeys=[${Object.keys(turn.slots).join(",")}]`,
    );

    // Step: awaiting_availability — the enquiry is already created; this reply
    // is the tester's stated callback time. Parse it, create ONE task, confirm.
    // The transition is CLAIMED atomically before the task is created, same as
    // reply-worker.
    if (enquiryStatus === "awaiting_availability") {
      const claimed = await internalChatRepository.claimStatusTransition(session.id, orgId, "awaiting_availability", "scheduled");
      if (!claimed) {
        const replyMessage = await persistReply("That callback has already been logged.");
        return { replyMessage };
      }

      const rawTime = userText.trim();
      const confirmReply = await generateTransitionReply(botConfig, kb, "callback_booked", rawTime, prevContext.onBehalfOfName, {
        orgId,
        feature: "staff_chat_test",
        userId: scope.userId ?? undefined,
      });
      const enquiryId = session.enquiryId;
      let taskId: string | undefined;
      if (enquiryId && prevContext.enquiryOwnerUserId) {
        const dueDate = await parseAvailabilityTime(rawTime, {
          orgId,
          feature: "staff_chat_test",
          userId: scope.userId ?? undefined,
        });
        const created = await taskService.create(
          {
            entityType: "enquiry",
            entityId: enquiryId,
            userId: prevContext.enquiryOwnerUserId,
            title: `Call back — client available ${rawTime}`,
            dueDate,
            completed: false,
          },
          systemScope(orgId),
        );
        taskId = created.id;
      } else {
        console.warn(`[internal-chat-testflow] session ${session.id} awaiting_availability but missing enquiryId/owner — skipping task creation.`);
      }
      await internalChatRepository.updateSession(session.id, orgId, {
        needsHuman: true,
        context: { lastReply: confirmReply, availabilityTaskId: taskId, contactName: prevContext.contactName },
      });
      const replyMessage = await persistReply(confirmReply);
      return { replyMessage };
    }

    // Step: create the enquiry — IMMEDIATELY, on this same turn, once the
    // required core fields are complete (or the ask-cap is hit) — no more
    // grouped follow-up round for whatever optional fields are still missing
    // (those land in the enquiry note via missingBeforeCreate instead).
    // Driven by the COLLECTED DATA, not the model's intent label. `enquiryStatus`
    // here is the status BEFORE this turn (null on a brand-new enquiry that
    // just became complete in one message, or "collecting" if gathered across
    // several turns) — the atomic claim below transitions FROM that value
    // either way. Mirrors reply-worker.
    if (readyToCreate) {
      const claimed = await internalChatRepository.claimStatusTransition(session.id, orgId, enquiryStatus, "awaiting_availability");
      if (!claimed) {
        const replyMessage = await persistReply("That's already been logged.");
        return { replyMessage };
      }

      console.log(
        `[internal-chat-testflow] session ${session.id} CREATING enquiry (clientId=${enquiryClientId ?? "null"}) from slotKeys=[${Object.keys(mergedSlots).join(",")}]`,
      );
      const summary = buildEnquirySummary(mergedSlots);
      // Test-mode enquiries are now created as REAL records (is_test=false) so
      // they show up in the assistant/admin-bot lookups. NOTE: this means they
      // also count in real reports/dashboards — they are indistinguishable from
      // production enquiries (only the synthetic client's "TEST" badge hints at
      // their origin). enquiryClientId is the traveller for an on-behalf enquiry.
      let enquiryId: string | null = null;
      let ownerUserId: string | null = null;
      try {
        const created = await resolveAndCreateEnquiry(orgId, enquiryClientId, mergedSlots, {
          summary,
          missingFields: missingBeforeCreate,
          // Test-flow enquiries are synthetic — tag the transaction is_test so
          // they never pollute real reporting (this flag existed for exactly
          // this driver but was never passed).
          isTest: true,
        });
        enquiryId = created.enquiryId;
        ownerUserId = created.ownerUserId;
      } catch (err) {
        console.error(`[internal-chat-testflow] session ${session.id} resolveAndCreateEnquiry THREW:`, err);
      }

      if (!enquiryId) {
        console.warn(`[internal-chat-testflow] session ${session.id} enquiry creation failed after claim (enquiryId=null) — handing off`);
        await internalChatRepository.updateSession(session.id, orgId, { enquiryStatus: null, enquirySlots: {} });
        const replyMessage = await doHandoff(
          prevContext,
          "Sorry, I'm having trouble logging that automatically — let me get a colleague to help you.",
        );
        return { replyMessage };
      }
      console.log(`[internal-chat-testflow] session ${session.id} Created enquiry ${enquiryId} — asking for callback time`);

      const onBehalfOfName = prevContext.beneficiary?.name;
      const askTimeReply = await generateTransitionReply(botConfig, kb, "ask_callback_time", undefined, onBehalfOfName, {
        orgId,
        feature: "staff_chat_test",
        userId: scope.userId ?? undefined,
      });
      await internalChatRepository.updateSession(session.id, orgId, {
        intent: "enquiry",
        enquiryId,
        enquirySlots: {},
        needsHuman: false, // stays live to ask for a callback time
        context: { lastReply: askTimeReply, groupedAskSent: false, enquiryOwnerUserId: ownerUserId ?? undefined, onBehalfOfName, contactName: prevContext.contactName },
      });
      const replyMessage = await persistReply(askTimeReply);
      return { replyMessage };
    }

    // Step: enquiry intent, still collecting (readyToCreate was false above,
    // so either there's not enough signal yet, or the required core fields
    // are still incomplete and we're under the ask-cap).
    if (treatAsEnquiry) {
      if (!substantive) {
        // Soft anti-empty threshold not met — keep collecting naturally.
        console.log(`[internal-chat-testflow] session ${session.id} BRANCH=collecting-thin (enquiry, not enough signal yet)`);
        await internalChatRepository.updateSession(session.id, orgId, {
          intent: "enquiry",
          enquiryStatus: "collecting",
          enquirySlots: mergedSlots,
          context: { ...prevContext, lastReply: turn.reply, askCount: askCount + 1 },
        });
        const replyMessage = await persistReply(turn.reply);
        return { replyMessage };
      }

      // Required core still incomplete and under the ask-cap — keep
      // collecting naturally with the model's own next question (which, per
      // the prompt, only ever asks about the missing CORE fields — never the
      // nice-to-haves). Mirrors reply-worker.
      console.log(
        `[internal-chat-testflow] session ${session.id} BRANCH=collecting-continue coreMissing=[${coreMissing.join("|")}] askCount=${askCount}`,
      );
      await internalChatRepository.updateSession(session.id, orgId, {
        intent: "enquiry",
        enquiryStatus: "collecting",
        enquirySlots: mergedSlots,
        context: { ...prevContext, lastReply: turn.reply, askCount: askCount + 1 },
      });
      const replyMessage = await persistReply(turn.reply);
      return { replyMessage };
    }

    // Terminal wind-down: breaks the "all set" repeat loop for non-enquiry
    // chatter. Unlike reply-worker (which stays silent to avoid pestering a
    // real customer's phone), the tester always gets a reply — if it would
    // repeat, we still show the (repeated) line rather than sending nothing.
    if (wouldRepeat || customerAcked) {
      await internalChatRepository.updateSession(session.id, orgId, {
        needsHuman: true,
        context: { ...prevContext, lastReply: turn.reply },
      });
      const replyMessage = await persistReply(turn.reply);
      return { replyMessage };
    }

    // Normal turn: a non-enquiry message — just answer helpfully.
    await internalChatRepository.updateSession(session.id, orgId, {
      intent: "other",
      context: { ...prevContext, lastReply: turn.reply },
    });
    const replyMessage = await persistReply(turn.reply);
    return { replyMessage };
  },
};
