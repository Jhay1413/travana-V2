import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import {
  buildEnquirySummary,
  buildPhoneConflictReply,
  buildTranscript,
  generateGeneralReply,
  generateGroupedAsk,
  generateTransitionReply,
  generateTurn,
  hasSubstantiveSignal,
  isAcknowledgement,
  looksLikeActionableAdmin,
  looksLikeAdminAsk,
  mergeSlots,
  missingFieldsFor,
  parseAvailabilityTime,
  similarReply,
} from "../ai-conversation/ai-conversation.brain";
import { classifyConversationRoute } from "../ai-conversation/conversation-router";
import type { EnquirySlots, RetrievedContext, RetrievedMatch, TranscriptMessage } from "../ai-conversation/ai-conversation.types";
import { botConfigRepository } from "../bot-config/bot-config.repository";
import { knowledgeBaseRepository } from "../knowledge-base/knowledge-base.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { adminAgent } from "../sendseven-webhook/admin-agent.service";
import { resolveAndCreateEnquiry } from "../sendseven-webhook/enquiry-auto-create.service";
import {
  extractPhoneNumber,
  insertClient,
  resolveOrCreateByDetails,
  samePhoneNumber,
  systemScope,
} from "../sendseven-webhook/identity.service";
import { taskService } from "../task/task.service";
import { resolveOrCreateTestClient } from "./internal-chat-identity.service";
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
  groupedAskSent?: boolean;
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
const GENERIC_TRAVELLER_RE =
  /^(?:(?:a|my|your|his|her|their|the)\s+)?(?:friend|mate|buddy|pal|someone|somebody|colleague|co-?worker|client|customer|person|people|guy|lady|companion|partner|other\s+half)$/i;
function cleanTravellerName(raw?: string): string | undefined {
  const v = (raw ?? "").trim();
  if (!v || GENERIC_TRAVELLER_RE.test(v)) return undefined;
  return v;
}

const HISTORY_LIMIT = 20;
const FALLBACK_REPLY = "Thanks for your message — one of our advisors will be in touch shortly.";

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
  async runTestFlowTurn(session: InternalChatSession, userText: string, scope: Scope): Promise<RunTestFlowTurnResult> {
    const orgId = session.orgId;

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

    const [botConfig, kb, existingClient] = await Promise.all([
      botConfigRepository.findByOrg(orgId),
      knowledgeBaseRepository.list(orgId),
      clientId ? neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null) : Promise.resolve(null),
    ]);

    const recent = await internalChatRepository.getRecentMessages(session.id, orgId, HISTORY_LIMIT);
    const transcript = buildTranscript(toTranscriptMessages(recent), userText);

    // A test session can, in principle, run several enquiries end to end — once
    // one is fully wrapped (scheduled), start the next from a clean slate. In
    // practice this session will already have needsHuman=true by then and be
    // caught by the check above, but this mirrors reply-worker's guard exactly.
    const isFreshEnquiry = session.enquiryStatus === "created" || session.enquiryStatus === "scheduled";
    const enquiryStatus = isFreshEnquiry ? null : session.enquiryStatus;
    const priorSlots: EnquirySlots = isFreshEnquiry ? {} : ((session.enquirySlots as EnquirySlots) ?? {});
    const prevContext = (session.context as ConversationContext | null) ?? {};
    // Carry admin intent across the onboarding detour (see reply-worker) — the
    // completion turn's literal message is just a phone number, so its own route
    // classification is unreliable.
    let sawAdminIntent = prevContext.domain === "admin" || looksLikeAdminAsk(userText);

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
    const enquiryInFlight =
      enquiryStatus === "collecting" ||
      enquiryStatus === "awaiting_availability" ||
      !!prevContext.groupedAskSent ||
      !!prevContext.beneficiary ||
      hasSubstantiveSignal(priorSlots);
    // Do NOT force admin purely because a PRIOR turn set domain="admin" (sticky).
    // A single router misfire would otherwise trap the whole conversation in
    // admin and open a ticket instead of logging a sales enquiry. Only a
    // DETERMINISTIC admin ask forces admin; otherwise the classifier decides,
    // with the prior domain passed as a sticky HINT so genuine admin follow-ups
    // still stay admin but a clear new-holiday message can recover to sales.
    const route: "sales" | "admin" | "general" = enquiryInFlight
      ? "sales"
      : looksLikeAdminAsk(userText)
        ? "admin"
        : await classifyConversationRoute({
            transcript,
            latestText: userText,
            enquiryInFlight,
            priorDomainAdmin: prevContext.domain === "admin",
          });
    console.log(
      `[internal-chat-testflow] session=${session.id} ROUTE=${route} enquiryInFlight=${enquiryInFlight} ` +
        `status=${enquiryStatus} groupedAskSent=${!!prevContext.groupedAskSent} beneficiary=${!!prevContext.beneficiary} ` +
        `sawAdminIntent=${sawAdminIntent} domain=${prevContext.domain ?? "none"} priorSubstantive=${hasSubstantiveSignal(priorSlots)}`,
    );

    // ── General route ────────────────────────────────────────────────────
    // No booking or admin intent — just converse normally. No identity is
    // needed, so this skips both the onboarding gate and the enquiry bot's
    // slot-filling entirely.
    if (route === "general") {
      const reply = await generateGeneralReply(botConfig, kb, transcript, existingClient);
      await internalChatRepository.updateSession(session.id, orgId, {
        intent: "other",
        context: { ...prevContext, lastReply: reply },
      });
      const replyMessage = await persistReply(reply);
      return { replyMessage };
    }

    // Client onboarding gate: for an unknown synthetic contact, collect full
    // name + phone ONLY (no email), then create/reuse the test client and
    // fall through to process the enquiry turn in the same call.
    if (!knownClient) {
      const onboard = await generateTurn(botConfig, kb, null, transcript, enquiryStatus, priorSlots, false);
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
          }
          const replyMessage = await persistReply(onboard.reply);
          return { replyMessage };
        }

        clientId = await resolveOrCreateTestClient(orgId, scope.userId, { fullName: full, phone });
        await internalChatRepository.updateSession(session.id, orgId, { clientId });
      }
    }

    const clientRecord = knownClient
      ? existingClient
      : clientId
        ? await neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null)
        : null;

    // `route` was already decided above (before onboarding).

    // ── Admin bot ──────────────────────────────────────────────────────────
    // Fail-closed on clientId. Answers from the client's OWN records.
    if (route === "admin" && clientId) {
      // Actionable = complaint / details submission (needs a ticket) vs a
      // read-only records query. Once we've asked once for an actionable matter
      // without opening a ticket, force the ticket instead of re-asking.
      const adminActionable = !!prevContext.adminActionable || looksLikeActionableAdmin(userText);
      const forceTicketNow = adminActionable && !!prevContext.adminAsked && !prevContext.ticketOpened;
      console.log(
        `[internal-chat-testflow] session=${session.id} route=admin actionable=${adminActionable} ` +
          `adminAsked=${!!prevContext.adminAsked} forceTicket=${forceTicketNow} -> admin agent`,
      );
      const adminResult = await adminAgent.answer(
        orgId,
        clientId,
        botConfig,
        kb,
        transcript,
        clientRecord,
        undefined,
        undefined,
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
    // Vector retrieval (best-effort): KB always, past quotes only for
    // enquiry-ish turns.
    const enquiryish =
      enquiryStatus === "collecting" || enquiryStatus === "awaiting_availability" || hasSubstantiveSignal(priorSlots);
    const [kbMatches, quoteMatches] = await Promise.all([
      aiEmbeddingsService.retrieve({ orgId, sourceType: "knowledge", query: userText, limit: 3 }),
      enquiryish
        ? aiEmbeddingsService.retrieve({ orgId, sourceType: "quote", query: `${userText} ${JSON.stringify(priorSlots)}`, limit: 4 })
        : Promise.resolve([] as RetrievedMatch[]),
    ]);
    const retrieved: RetrievedContext = { kb: kbMatches, quotes: quoteMatches };

    const turn = await generateTurn(botConfig, kb, clientRecord, transcript, enquiryStatus, priorSlots, true, retrieved);

    if (turn.hand_off) {
      const replyMessage = await doHandoff(prevContext, turn.reply);
      return { replyMessage };
    }

    const customerAcked = isAcknowledgement(userText.trim());
    const lastReply = prevContext.lastReply ?? "";
    const wouldRepeat = similarReply(turn.reply, lastReply);
    const mergedSlots = mergeSlots(priorSlots, turn.slots);

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
      const travellerPhone =
        (benTurn?.phone?.trim() || extractPhoneNumber(userText) || benCtx?.phone || "").trim() || undefined;
      let benClientId = benCtx?.clientId;

      if (!benClientId) {
        if (!travellerName || !travellerPhone) {
          // Need the traveller's NAME and/or phone before logging under them —
          // ask for exactly what's missing, never invent a placeholder name.
          const ask =
            !travellerName && !travellerPhone
              ? "Of course! Could you pop me your friend's name and phone number so I can get this set up for them? 😊"
              : !travellerName
                ? "Lovely! And what's your friend's name so I can get this set up for them? 😊"
                : `Of course! Could you pop me ${travellerName}'s phone number so I can get this set up for them? 😊`;
          await internalChatRepository.updateSession(session.id, orgId, {
            intent: "enquiry",
            enquiryStatus: "collecting",
            enquirySlots: mergedSlots,
            context: { ...prevContext, lastReply: ask, beneficiary: { name: travellerName, phone: travellerPhone } },
          });
          console.log(`[internal-chat-testflow] session ${session.id} on-behalf enquiry — asking for traveller name/phone (name=${travellerName ?? "?"} phone=${travellerPhone ?? "?"})`);
          const replyMessage = await persistReply(ask);
          return { replyMessage };
        }

        const pendingBenConflict = benCtx?.phoneConflictPhone;
        if (pendingBenConflict && samePhoneNumber(pendingBenConflict, travellerPhone)) {
          benClientId = await insertClient(orgId, { fullName: travellerName, phone: travellerPhone });
        } else {
          const resolution = await resolveOrCreateByDetails(orgId, { fullName: travellerName, phone: travellerPhone });
          if (resolution.status === "phone_conflict") {
            const confirmReply = buildPhoneConflictReply(resolution.existingNames, travellerName);
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
            console.log(`[internal-chat-testflow] session ${session.id} beneficiary phone clash — ${resolution.existingNames.join(", ")}; asked to confirm`);
            const replyMessage = await persistReply(confirmReply);
            return { replyMessage };
          }
          benClientId = resolution.clientId;
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
    const missingBeforeCreate = missingFieldsFor(mergedSlots);
    const readyToCreate =
      enquiryStatus === "collecting" && (!!prevContext.groupedAskSent || missingBeforeCreate.length === 0);

    console.log(
      `[internal-chat-testflow] session=${session.id} ENQUIRY-DECISION route=${route} intent=${turn.intent} ` +
        `status=${enquiryStatus} groupedAskSent=${!!prevContext.groupedAskSent} substantive=${substantive} ` +
        `treatAsEnquiry=${treatAsEnquiry} missing=${missingBeforeCreate.length}[${missingBeforeCreate.join("|")}] ` +
        `readyToCreate=${readyToCreate} beneficiary=${beneficiaryActive} enquiryClientId=${enquiryClientId ?? "null"} ` +
        `mergedSlots=${JSON.stringify(mergedSlots)} rawTurnSlots=${JSON.stringify(turn.slots)}`,
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
      const confirmReply = await generateTransitionReply(botConfig, kb, "callback_booked", rawTime, prevContext.onBehalfOfName);
      const enquiryId = session.enquiryId;
      let taskId: string | undefined;
      if (enquiryId && prevContext.enquiryOwnerUserId) {
        const dueDate = await parseAvailabilityTime(rawTime);
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
        context: { lastReply: confirmReply, availabilityTaskId: taskId },
      });
      const replyMessage = await persistReply(confirmReply);
      return { replyMessage };
    }

    // Step: create the enquiry. Fires once we're mid-collection AND either the
    // grouped follow-up was sent OR nothing's left worth asking. Driven by the
    // COLLECTED DATA, not the model's intent label. Mirrors reply-worker.
    if (readyToCreate) {
      if (!substantive) {
        // Nothing substantive to log (declined / off-topic) — hand off.
        console.log(`[internal-chat-testflow] session ${session.id} nothing substantive to log after ask — handing off instead of creating`);
        const replyMessage = await doHandoff(prevContext, turn.reply);
        return { replyMessage };
      }

      const claimed = await internalChatRepository.claimStatusTransition(session.id, orgId, "collecting", "awaiting_availability");
      if (!claimed) {
        const replyMessage = await persistReply("That's already been logged.");
        return { replyMessage };
      }

      console.log(
        `[internal-chat-testflow] session ${session.id} CREATING enquiry (clientId=${enquiryClientId ?? "null"}) from slots=${JSON.stringify(mergedSlots)}`,
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
      const askTimeReply = await generateTransitionReply(botConfig, kb, "ask_callback_time", undefined, onBehalfOfName);
      await internalChatRepository.updateSession(session.id, orgId, {
        intent: "enquiry",
        enquiryId,
        enquirySlots: {},
        needsHuman: false, // stays live to ask for a callback time
        context: { lastReply: askTimeReply, groupedAskSent: false, enquiryOwnerUserId: ownerUserId ?? undefined, onBehalfOfName },
      });
      const replyMessage = await persistReply(askTimeReply);
      return { replyMessage };
    }

    // Step: enquiry, grouped ask not yet sent.
    if (treatAsEnquiry) {
      if (!substantive) {
        // Soft anti-empty threshold not met — keep collecting naturally.
        console.log(`[internal-chat-testflow] session ${session.id} BRANCH=collecting-thin (enquiry, not enough signal yet)`);
        await internalChatRepository.updateSession(session.id, orgId, {
          intent: "enquiry",
          enquiryStatus: "collecting",
          enquirySlots: mergedSlots,
          context: { ...prevContext, lastReply: turn.reply },
        });
        const replyMessage = await persistReply(turn.reply);
        return { replyMessage };
      }

      // Enough signal — send the ONE grouped follow-up for whatever's missing.
      console.log(`[internal-chat-testflow] session ${session.id} BRANCH=grouped-ask (setting groupedAskSent=true, missing=${missingBeforeCreate.join("|")})`);
      const groupedReply = await generateGroupedAsk(botConfig, kb, missingBeforeCreate, transcript);
      await internalChatRepository.updateSession(session.id, orgId, {
        intent: "enquiry",
        enquiryStatus: "collecting",
        enquirySlots: mergedSlots,
        context: { ...prevContext, lastReply: groupedReply, groupedAskSent: true },
      });
      const replyMessage = await persistReply(groupedReply);
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
