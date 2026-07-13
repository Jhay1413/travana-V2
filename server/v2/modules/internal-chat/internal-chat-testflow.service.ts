import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import {
  buildEnquirySummary,
  buildTranscript,
  generateGroupedAsk,
  generateTransitionReply,
  generateTurn,
  hasSubstantiveSignal,
  isAcknowledgement,
  mergeSlots,
  missingFieldsFor,
  parseAvailabilityTime,
  similarReply,
} from "../ai-conversation/ai-conversation.brain";
import type { EnquirySlots, RetrievedContext, RetrievedMatch, TranscriptMessage } from "../ai-conversation/ai-conversation.types";
import { botConfigRepository } from "../bot-config/bot-config.repository";
import { knowledgeBaseRepository } from "../knowledge-base/knowledge-base.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { resolveAndCreateEnquiry } from "../sendseven-webhook/enquiry-auto-create.service";
import { systemScope } from "../sendseven-webhook/identity.service";
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

    // Client onboarding gate: for an unknown synthetic contact, collect full
    // name + phone ONLY (no email), then create/reuse the test client and
    // fall through to process the enquiry turn in the same call.
    if (!knownClient) {
      const onboard = await generateTurn(botConfig, kb, null, transcript, enquiryStatus, priorSlots, false);
      if (onboard.hand_off) {
        const replyMessage = await doHandoff(prevContext, onboard.reply);
        return { replyMessage };
      }

      const full = onboard.client?.fullName?.trim();
      const phone = onboard.client?.phone?.trim();
      if (!(full && phone)) {
        const replyMessage = await persistReply(onboard.reply);
        return { replyMessage };
      }

      clientId = await resolveOrCreateTestClient(orgId, scope.userId, { fullName: full, phone });
      await internalChatRepository.updateSession(session.id, orgId, { clientId });
    }

    const clientRecord = knownClient
      ? existingClient
      : clientId
        ? await neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null)
        : null;

    // Vector retrieval (best-effort, same gating as reply-worker): KB always,
    // past quotes only for enquiry-ish turns.
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
      const confirmReply = await generateTransitionReply(botConfig, kb, "callback_booked");
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

    // Step: the ONE grouped follow-up has already been sent — this reply
    // creates the enquiry immediately, whatever is still missing. Guarded on
    // enquiryStatus="collecting" and an atomic claim, same as reply-worker.
    if (prevContext.groupedAskSent && enquiryStatus === "collecting") {
      if (turn.intent !== "enquiry") {
        const replyMessage = await doHandoff(prevContext, turn.reply);
        return { replyMessage };
      }

      const claimed = await internalChatRepository.claimStatusTransition(session.id, orgId, "collecting", "awaiting_availability");
      if (!claimed) {
        const replyMessage = await persistReply("That's already been logged.");
        return { replyMessage };
      }

      const missing = missingFieldsFor(mergedSlots);
      const summary = buildEnquirySummary(mergedSlots);
      const { enquiryId, ownerUserId } = await resolveAndCreateEnquiry(orgId, clientId, mergedSlots, {
        summary,
        missingFields: missing,
        isTest: true,
      });

      if (!enquiryId) {
        await internalChatRepository.updateSession(session.id, orgId, { enquiryStatus: null, enquirySlots: {} });
        const replyMessage = await doHandoff(
          prevContext,
          "Sorry, I'm having trouble logging that automatically — let me get a colleague to help you.",
        );
        return { replyMessage };
      }

      const askTimeReply = await generateTransitionReply(botConfig, kb, "ask_callback_time");
      await internalChatRepository.updateSession(session.id, orgId, {
        intent: "enquiry",
        enquiryId,
        enquirySlots: {},
        needsHuman: false, // stays live to ask for a callback time
        context: { lastReply: askTimeReply, groupedAskSent: false, enquiryOwnerUserId: ownerUserId ?? undefined },
      });
      const replyMessage = await persistReply(askTimeReply);
      return { replyMessage };
    }

    // Step: enquiry intent, grouped ask not yet sent.
    if (turn.intent === "enquiry") {
      if (!hasSubstantiveSignal(mergedSlots)) {
        // Soft anti-empty threshold not met — keep collecting naturally.
        await internalChatRepository.updateSession(session.id, orgId, {
          intent: "enquiry",
          enquiryStatus: "collecting",
          enquirySlots: mergedSlots,
        });
        const replyMessage = await persistReply(turn.reply);
        return { replyMessage };
      }

      // Enough signal — send the ONE grouped follow-up for whatever's missing.
      const missing = missingFieldsFor(mergedSlots);
      const groupedReply = await generateGroupedAsk(botConfig, kb, missing, transcript);
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
