import { runWithSendSevenConfigAsync } from "../../utils/sendseven";
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
import { botConfigRepository } from "../bot-config/bot-config.repository";
import { conversationIntegrationRepository } from "../conversation-integration/conversation-integration.repository";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { knowledgeBaseRepository } from "../knowledge-base/knowledge-base.repository";
import { messagesRepository } from "../messages/messages.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { conversationStateRepository } from "./conversation-state.repository";
import { sendsevenWebhookRepository } from "./sendseven-webhook.repository";
import { resolveAndCreateEnquiry } from "./enquiry-auto-create.service";
import { createAndLinkClient, resolveExistingClient, systemScope } from "./identity.service";
import { taskService } from "../task/task.service";
import type { EnquirySlots, RetrievedContext, RetrievedMatch } from "../ai-conversation/ai-conversation.types";
import type { SsWebhookEvent } from "./sendseven-webhook.types";
import type { SendsevenConversationState } from "@shared/schema";

// Transient flags/context we keep on `sendseven_conversation_state.context`
// (jsonb) across the grouped-ask → create → awaiting-availability → scheduled
// flow. No schema columns needed.
interface ConversationContext {
  lastReply?: string;
  // Set once we've sent the ONE grouped follow-up asking for whatever enquiry
  // fields are still missing — the customer's next reply creates the enquiry.
  groupedAskSent?: boolean;
  // The org user the just-created enquiry is owned by — reused as the
  // assignee of the callback task at the awaiting_availability step.
  enquiryOwnerUserId?: string;
  // Guards against double-creating the callback task if the inbound is
  // reprocessed while still in awaiting_availability.
  availabilityTaskId?: string;
}

// Tag our outbound so the message.sent webhook can tell it from a human agent's
// reply (§8). Human replies (untagged) trigger the hand-off.
const AI_META = { source: "travana-ai" };
const HISTORY_LIMIT = 20;
const RESUME_AFTER_MS = 60 * 60 * 1000; // AI re-engages after 1h of no activity
const FALLBACK_REPLY = "Thanks for your message — one of our advisors will be in touch shortly.";

export const replyWorker = {
  // Handles one inbound customer message: identity resolution → AI turn → enquiry
  // slot-filling / reply (draft or send). Assumes the delivery is verified and the
  // org has auto-reply on.
  async handleInbound(orgId: string, event: SsWebhookEvent): Promise<void> {
    const message = event.data?.message;
    const contact = event.data?.contact as { id?: string; name?: string; phone?: string; email?: string } | undefined;
    const conversationId = message?.conversation_id;
    if (!conversationId || !message) return;
    if (message.direction !== "inbound" || !message.text?.trim()) return;

    const contactId = message.contact_id ?? contact?.id ?? null;

    // Inactivity is measured from the LAST time we touched the conversation, taken
    // BEFORE ensure() bumps updatedAt for this message.
    const prior = await conversationStateRepository.find(conversationId);
    const inactiveMs = prior?.updatedAt ? Date.now() - new Date(prior.updatedAt).getTime() : Infinity;

    const state = await conversationStateRepository.ensure(conversationId, orgId, contactId);

    // Handed to a human (asked for an agent, or an enquiry was logged): the AI stays
    // silent — UNLESS the conversation has been idle for over an hour, in which case
    // it re-engages with a clean slate.
    if (prior?.needsHuman) {
      if (inactiveMs < RESUME_AFTER_MS) {
        console.log(`[sendseven-webhook] conv ${conversationId} handed to human (active ${Math.round(inactiveMs / 1000)}s ago) — staying silent`);
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

    const cfg = await conversationIntegrationService.resolveConfig(orgId);
    if (!cfg) {
      console.warn(`[sendseven-webhook] org ${orgId} has no resolvable SendSeven config — skipping reply.`);
      return;
    }

    const integration = await conversationIntegrationRepository.findByOrg(orgId);
    const mode = integration?.autoReplyMode ?? "draft";

    const [botConfig, kb, client] = await Promise.all([
      botConfigRepository.findByOrg(orgId),
      knowledgeBaseRepository.list(orgId),
      clientId ? neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null) : Promise.resolve(null),
    ]);

    await runWithSendSevenConfigAsync(cfg, async () => {
      const list = await messagesRepository.list({ conversationId, page: 1, pageSize: HISTORY_LIMIT });
      // Only feed the AI messages from THIS session (since our state row began), so
      // old, already-logged enquiries in the SendSeven history don't confuse it.
      // 60s buffer guards against clock skew dropping the current message.
      const since = state.createdAt ? new Date(state.createdAt).getTime() - 60_000 : 0;
      const recent = list.items.filter((m) => !m.created_at || new Date(m.created_at).getTime() >= since);
      const transcript = buildTranscript(recent, message.text!.trim());

      // A conversation can hold several enquiries. Once one is fully wrapped up
      // (scheduled), start the next from a clean slate (empty slots, no status)
      // so a NEW enquiry isn't blocked by the previous one or polluted by its
      // details. ("created" is kept for back-compat with rows written before
      // this flow existed.)
      const isFreshEnquiry = state.enquiryStatus === "created" || state.enquiryStatus === "scheduled";
      const enquiryStatus = isFreshEnquiry ? null : state.enquiryStatus;
      const priorSlots: EnquirySlots = isFreshEnquiry ? {} : ((state.enquirySlots as EnquirySlots) ?? {});

      const doHandoff = async (reply: string) => {
        await conversationStateRepository.setNeedsHuman(conversationId);
        await messagesRepository.createInternalNote({
          conversation_id: conversationId,
          text: "🤖 AI handed this conversation to a human (customer asked for a person / out of scope).",
        });
        await sendReply(orgId, conversationId, message.channel_id, reply, mode, true);
      };

      // Client onboarding gate: for an unknown contact, collect full name + phone
      // ONLY (no email). If both arrive (even in the same message), create + link
      // and FALL THROUGH to process the enquiry in the same turn.
      if (!knownClient) {
        const onboard = await generateTurn(botConfig, kb, null, transcript, enquiryStatus, priorSlots, false);
        console.log(
          `[sendseven-webhook] conv=${conversationId} onboarding (unknown contact) mode=${mode} handoff=${onboard.hand_off} ` +
            `hasName=${!!onboard.client?.fullName} hasPhone=${!!onboard.client?.phone}`,
        );
        if (onboard.hand_off) return doHandoff(onboard.reply);

        const full = onboard.client?.fullName?.trim();
        const phone = onboard.client?.phone?.trim();
        if (!(full && phone && contactId)) {
          // Still missing details — ask for them and stop here.
          await sendReply(orgId, conversationId, message.channel_id, onboard.reply, mode, false);
          await conversationStateRepository.update(conversationId, { lastAiReplyAt: new Date() });
          return;
        }
        clientId = await createAndLinkClient(orgId, contactId, { fullName: full, phone, email: null });
        await conversationStateRepository.update(conversationId, { clientId });
        console.log(`[sendseven-webhook] Linked client ${clientId} for conv ${conversationId} (collected details)`);
      }

      // Known client (already, or just onboarded) → the enquiry/reply turn.
      const clientRecord = knownClient
        ? client
        : clientId
          ? await neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null)
          : null;

      // Vector retrieval (Phase 5d) — best-effort context for the system prompt.
      // Never blocks/breaks the reply: aiEmbeddingsService.retrieve() never throws
      // and resolves to [] on any failure, in which case the prompt renders exactly
      // as it did before this feature. Quote retrieval is gated to enquiry-ish turns
      // (an in-flight "collecting"/"awaiting_availability" status, or the customer
      // has already given some substantive enquiry detail) — otherwise it's skipped
      // entirely rather than wasting a round-trip on small talk.
      const latestText = message.text!.trim();
      const enquiryish =
        enquiryStatus === "collecting" || enquiryStatus === "awaiting_availability" || hasSubstantiveSignal(priorSlots);
      const [kbMatches, quoteMatches] = await Promise.all([
        aiEmbeddingsService.retrieve({ orgId, sourceType: "knowledge", query: latestText, limit: 3 }),
        enquiryish
          ? aiEmbeddingsService.retrieve({
              orgId,
              sourceType: "quote",
              query: `${latestText} ${JSON.stringify(priorSlots)}`,
              limit: 4,
            })
          : Promise.resolve([] as RetrievedMatch[]),
      ]);
      const retrieved: RetrievedContext = { kb: kbMatches, quotes: quoteMatches };

      const turn = await generateTurn(botConfig, kb, clientRecord, transcript, enquiryStatus, priorSlots, true, retrieved);
      console.log(
        `[sendseven-webhook] conv=${conversationId} known=${knownClient} mode=${mode} intent=${turn.intent} ` +
          `handoff=${turn.hand_off} status=${enquiryStatus}`,
      );

      if (turn.hand_off) return doHandoff(turn.reply);

      const customerAcked = isAcknowledgement(message.text!.trim());
      const prevContext = (state.context as ConversationContext | null) ?? {};
      const lastReply = prevContext.lastReply ?? "";
      const wouldRepeat = similarReply(turn.reply, lastReply);

      const update: Partial<SendsevenConversationState> = {
        lastAiReplyAt: new Date(),
        context: { ...prevContext, lastReply: turn.reply },
      };

      // Server-truth slots for this turn: merge the model's output onto what we
      // already had persisted, so a terse final reply can't drop earlier fields.
      const mergedSlots = mergeSlots(priorSlots, turn.slots);

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

        const rawTime = message.text!.trim();
        const confirmReply = await generateTransitionReply(botConfig, kb, "callback_booked");
        let taskId: string | undefined;
        if (state.enquiryId && prevContext.enquiryOwnerUserId) {
          const dueDate = await parseAvailabilityTime(rawTime);
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
          context: { lastReply: confirmReply, availabilityTaskId: taskId },
        });
        await sendReply(orgId, conversationId, message.channel_id, confirmReply, mode, false);
        return;
      }

      // Step: the ONE grouped follow-up has already been sent — this reply
      // creates the enquiry immediately, whatever is still missing. No
      // re-asking, no confirmation gate. Guarded on enquiryStatus="collecting"
      // (not just the context flag, which alone can't survive a reset) and on
      // an atomic claim taken BEFORE the create, so a retried/concurrent inbound
      // that loses the claim does nothing.
      if (prevContext.groupedAskSent && enquiryStatus === "collecting") {
        if (turn.intent !== "enquiry") {
          // Customer declined / went off-topic right after the grouped ask —
          // do not fabricate an enquiry from a non-answer; hand off instead.
          console.log(`[sendseven-webhook] conv ${conversationId} declined/derailed after grouped ask — handing off instead of creating`);
          return doHandoff(turn.reply);
        }

        const claimed = await conversationStateRepository.claimStatusTransition(conversationId, "collecting", "awaiting_availability");
        if (!claimed) {
          console.log(`[sendseven-webhook] conv ${conversationId} lost the create-enquiry claim — already actioned, skipping`);
          return;
        }

        const missing = missingFieldsFor(mergedSlots);
        const summary = buildEnquirySummary(mergedSlots);
        const { enquiryId, ownerUserId } = await resolveAndCreateEnquiry(orgId, clientId, mergedSlots, {
          summary,
          missingFields: missing,
        });

        if (!enquiryId) {
          // Do NOT report success on a failed create — undo the claimed status
          // and hand off to a human instead of pretending it's logged.
          console.warn(`[sendseven-webhook] org ${orgId} conv ${conversationId} enquiry creation failed after claim — handing off`);
          await conversationStateRepository.update(conversationId, { enquiryStatus: null, enquirySlots: {} });
          return doHandoff("Sorry, I'm having trouble logging that automatically — let me get a colleague to help you.");
        }

        const askTimeReply = await generateTransitionReply(botConfig, kb, "ask_callback_time");
        // enquiryStatus is already committed to "awaiting_availability" by the claim above.
        await conversationStateRepository.update(conversationId, {
          intent: "enquiry",
          enquiryId,
          enquirySlots: {},
          needsHuman: false, // AI stays live to ask for a callback time
          lastAiReplyAt: new Date(),
          context: { lastReply: askTimeReply, groupedAskSent: false, enquiryOwnerUserId: ownerUserId ?? undefined },
        });
        console.log(`[sendseven-webhook] Created enquiry ${enquiryId} for org ${orgId} conv ${conversationId} — asking for callback time`);
        await sendReply(orgId, conversationId, message.channel_id, askTimeReply, mode, false);
        return;
      }

      // Step: enquiry intent, grouped ask not yet sent.
      if (turn.intent === "enquiry") {
        if (!hasSubstantiveSignal(mergedSlots)) {
          // Soft anti-empty threshold not met — keep collecting naturally.
          update.intent = "enquiry";
          update.enquiryStatus = "collecting";
          update.enquirySlots = mergedSlots;
          await sendReply(orgId, conversationId, message.channel_id, turn.reply, mode, false);
          await conversationStateRepository.update(conversationId, update);
          return;
        }

        // Enough signal — send the ONE grouped follow-up for whatever's missing.
        const missing = missingFieldsFor(mergedSlots);
        const groupedReply = await generateGroupedAsk(botConfig, kb, missing, transcript);
        update.intent = "enquiry";
        update.enquiryStatus = "collecting";
        update.enquirySlots = mergedSlots;
        update.context = { ...prevContext, lastReply: groupedReply, groupedAskSent: true };
        await sendReply(orgId, conversationId, message.channel_id, groupedReply, mode, false);
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
        console.log(`[sendseven-webhook] conv ${conversationId} wound down (repeat=${wouldRepeat} ack=${customerAcked} status=${enquiryStatus}) — going silent`);
        await conversationStateRepository.update(conversationId, update);
        return;
      }

      // Normal turn: a non-enquiry message — just answer helpfully.
      update.intent = "other";
      await sendReply(orgId, conversationId, message.channel_id, turn.reply, mode, false);
      await conversationStateRepository.update(conversationId, update);
    });
  },
};

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
  const sentId = (sent as { id?: string } | null | undefined)?.id;
  if (sentId) await sendsevenWebhookRepository.markOurMessage(sentId, orgId);
}
