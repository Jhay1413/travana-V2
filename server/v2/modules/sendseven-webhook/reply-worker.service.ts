import { runWithSendSevenConfigAsync } from "../../utils/sendseven";
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
import { adminAgent } from "./admin-agent.service";
import type { PendingAttachment } from "./admin-data.service";
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
const RESUME_AFTER_MS = 60 * 60 * 1000; // AI re-engages after 1h of no activity
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
      // Admin intent is often expressed BEFORE the contact is identified (the
      // customer asks about their enquiry, THEN we collect their phone). Carry it
      // across the onboarding detour so the just-onboarded completion turn —
      // whose literal message is only a phone number — still routes to admin.
      let sawAdminIntent = prevContext.domain === "admin" || looksLikeAdminAsk(latestText);

      const doHandoff = async (reply: string) => {
        await conversationStateRepository.setNeedsHuman(conversationId);
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
      const enquiryInFlight =
        enquiryStatus === "collecting" ||
        enquiryStatus === "awaiting_availability" ||
        !!prevContext.groupedAskSent ||
        !!prevContext.beneficiary ||
        hasSubstantiveSignal(priorSlots);
      const hasAttachments = (list.items.find((m) => m.id === message.id)?.attachments ?? []).some((a) => a?.id);
      // Do NOT force admin purely because a PRIOR turn set domain="admin" (sticky).
      // A single router misfire would otherwise trap the whole conversation in
      // admin and open a ticket instead of logging a sales enquiry. An attachment
      // (document submission) or a DETERMINISTIC admin ask forces admin; otherwise
      // the classifier decides, with the prior domain as a sticky HINT so genuine
      // admin follow-ups stay admin but a clear new-holiday message recovers to sales.
      const route: "sales" | "admin" | "general" = enquiryInFlight
        ? "sales"
        : hasAttachments || looksLikeAdminAsk(latestText)
          ? "admin"
          : await classifyConversationRoute({
              transcript,
              latestText,
              enquiryInFlight,
              priorDomainAdmin: prevContext.domain === "admin",
            });
      console.log(
        `[sendseven-webhook] conv=${conversationId} ROUTE=${route} enquiryInFlight=${enquiryInFlight} ` +
          `status=${enquiryStatus} groupedAskSent=${!!prevContext.groupedAskSent} beneficiary=${!!prevContext.beneficiary} ` +
          `sawAdminIntent=${sawAdminIntent} domain=${prevContext.domain ?? "none"} attachments=${hasAttachments}`,
      );

      // ── General route ────────────────────────────────────────────────
      // No booking or admin intent — just converse normally. No identity is
      // needed, so this skips both the onboarding gate and the enquiry bot's
      // slot-filling entirely.
      if (route === "general") {
        if (!hasText) return; // nothing to reply to
        const reply = await generateGeneralReply(botConfig, kb, transcript, client);
        await sendReply(orgId, conversationId, message.channel_id, reply, mode, false);
        await conversationStateRepository.update(conversationId, {
          intent: "other",
          lastAiReplyAt: new Date(),
          context: { ...prevContext, lastReply: reply },
        });
        return;
      }

      // Client onboarding gate: for an unknown contact, collect full name + phone
      // ONLY (no email). If both arrive (even in the same message), create + link
      // and FALL THROUGH to process the enquiry in the same turn.
      if (!knownClient) {
        const onboard = await generateTurn(botConfig, kb, null, transcript, enquiryStatus, priorSlots, false);
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
        // the model drops the flag on the next turn.
        const beneficiaryEnquiry = !!prevContext.beneficiary || !!onboard.beneficiary?.onBehalf;
        if (beneficiaryEnquiry && !prevContext.beneficiary) {
          prevContext.beneficiary = { name: cleanTravellerName(onboard.beneficiary?.fullName) };
        }
        if (!beneficiaryEnquiry) {
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
          // bot serves the request.
          await sendReply(orgId, conversationId, message.channel_id, onboard.reply, mode, false);
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
            const confirmReply = buildPhoneConflictReply(resolution.existingNames);
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
              `[sendseven-webhook] conv ${conversationId} phone clash — number belongs to ${resolution.existingNames.join(", ")}; asked to confirm`,
            );
            return;
          }
          clientId = resolution.clientId;
          delete prevContext.phoneConflictPhone;
          await conversationStateRepository.update(conversationId, { clientId, context: { ...prevContext } });
          console.log(`[sendseven-webhook] Linked client ${clientId} for conv ${conversationId} (collected details)`);
        }
        } // end !beneficiaryEnquiry — a third-party enquiry falls through to sales below
      }

      // Known client (already, or just onboarded) → the enquiry/reply turn.
      const clientRecord = knownClient
        ? client
        : clientId
          ? await neonClientService.getNeonClientById(clientId, systemScope(orgId)).catch(() => null)
          : null;

      // ── Attachments (SendSeven only) ───────────────────────────────────
      // A customer can send a document (e.g. a passport photo) with no caption.
      // Attachments aren't in the text transcript, so pull them off the current
      // message and download the bytes. They are NOT saved to the client's files
      // — instead they're handed to the admin bot, which attaches them to the
      // ticket it opens (staff can move them to the client record from there).
      // Best-effort: a failed download never breaks the reply.
      const currentAttachments = (list.items.find((m) => m.id === message.id)?.attachments ?? []).filter((a) => a?.id);
      const pendingAttachments: PendingAttachment[] = [];
      if (currentAttachments.length && clientId) {
        for (const att of currentAttachments) {
          try {
            const dl = await messagesRepository.downloadAttachment(att.id);
            pendingAttachments.push({ buffer: dl.buffer, filename: att.filename, contentType: att.content_type, size: att.file_size });
          } catch (err) {
            console.error(`[sendseven-webhook] conv ${conversationId} failed to download attachment ${att.id}:`, err);
          }
        }
      }
      const attachmentNote = pendingAttachments.length
        ? `The customer has just sent the following file(s) in their latest message: ${pendingAttachments.map((a) => a.filename).join(", ")}. ` +
          "Treat this as a document submission: use open_ticket to log it for a colleague — the file(s) will be attached to that ticket automatically. Then confirm to the customer you've received and logged it. Do NOT claim to have checked or verified the document yourself."
        : undefined;
      if (pendingAttachments.length) {
        console.log(`[sendseven-webhook] conv ${conversationId} downloaded ${pendingAttachments.length} attachment(s) for a ticket`);
      }

      // Nothing actionable (a media message we couldn't download, or an empty
      // text) — stay silent rather than replying to nothing.
      if (!hasText && !attachmentNote) return;

      // `route` was already decided above (before onboarding). Saved
      // attachments and admin intent carried across the onboarding detour
      // (sawAdminIntent) already fed into that decision.

      // ── Admin bot ──────────────────────────────────────────────────────
      // Fail-closed on clientId (only ever set via a verified link / phone-email
      // match / onboarding). The admin bot answers from the client's OWN records.
      if (route === "admin" && clientId) {
        // Actionable = complaint / details / document submission (needs a ticket),
        // vs a read-only records query. Once we've asked once for an actionable
        // matter without opening a ticket, force the ticket rather than re-asking.
        const adminActionable = !!prevContext.adminActionable || looksLikeActionableAdmin(latestText) || !!attachmentNote;
        const forceTicketNow = adminActionable && !!prevContext.adminAsked && !prevContext.ticketOpened;
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
          await sendReply(orgId, conversationId, message.channel_id, adminResult.reply, mode, false);
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

      // ── Sales / enquiry bot (UNCHANGED flow) ───────────────────────────
      // Vector retrieval (Phase 5d) — best-effort context for the enquiry prompt.
      // Never blocks/breaks the reply: aiEmbeddingsService.retrieve() never throws
      // and resolves to [] on any failure. Quote retrieval is gated to enquiry-ish
      // turns; otherwise it's skipped rather than wasting a round-trip.
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
      const lastReply = prevContext.lastReply ?? "";
      const wouldRepeat = similarReply(turn.reply, lastReply);

      const update: Partial<SendsevenConversationState> = {
        lastAiReplyAt: new Date(),
        context: { ...prevContext, lastReply: turn.reply },
      };

      // Server-truth slots for this turn: merge the model's output onto what we
      // already had persisted, so a terse final reply can't drop earlier fields.
      const mergedSlots = mergeSlots(priorSlots, turn.slots);

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
        // Robust phone capture: the model's field OR a phone-shaped token in the
        // latest message OR one we remembered — so a bare "09355152084" is caught
        // even when the model stops echoing it back.
        const travellerPhone =
          (benTurn?.phone?.trim() || extractPhoneNumber(latestText) || benCtx?.phone || "").trim() || undefined;
        let benClientId = benCtx?.clientId;

        if (!benClientId) {
          if (!travellerName || !travellerPhone) {
            // We still need the traveller's NAME and/or phone before we can log
            // the enquiry under them — ask for exactly what's missing (never
            // invent a placeholder name). Hold the enquiry until we have both.
            const ask =
              !travellerName && !travellerPhone
                ? "Of course! Could you pop me your friend's name and phone number so I can get this set up for them? 😊"
                : !travellerName
                  ? "Lovely! And what's your friend's name so I can get this set up for them? 😊"
                  : `Of course! Could you pop me ${travellerName}'s phone number so I can get this set up for them? 😊`;
            await sendReply(orgId, conversationId, message.channel_id, ask, mode, false);
            await conversationStateRepository.update(conversationId, {
              intent: "enquiry",
              enquiryStatus: "collecting",
              enquirySlots: mergedSlots,
              lastAiReplyAt: new Date(),
              context: { ...prevContext, lastReply: ask, beneficiary: { name: travellerName, phone: travellerPhone } },
            });
            console.log(`[sendseven-webhook] conv ${conversationId} on-behalf enquiry — asking for traveller name/phone (name=${travellerName ?? "?"} phone=${travellerPhone ?? "?"})`);
            return;
          }

          // Have a real name + phone → resolve/create the traveller. NO contact
          // link — the traveller isn't the person messaging.
          const pendingBenConflict = benCtx?.phoneConflictPhone;
          if (pendingBenConflict && samePhoneNumber(pendingBenConflict, travellerPhone)) {
            benClientId = await insertClient(orgId, { fullName: travellerName, phone: travellerPhone });
            console.log(`[sendseven-webhook] conv ${conversationId} beneficiary phone confirmed after clash — created client ${benClientId} for ${travellerName}`);
          } else {
            const resolution = await resolveOrCreateByDetails(orgId, { fullName: travellerName, phone: travellerPhone });
            if (resolution.status === "phone_conflict") {
              const confirmReply = buildPhoneConflictReply(resolution.existingNames, travellerName);
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
                `[sendseven-webhook] conv ${conversationId} beneficiary phone clash — belongs to ${resolution.existingNames.join(", ")}; asked to confirm`,
              );
              return;
            }
            benClientId = resolution.clientId;
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

      // Enquiry-ness for the branches below. Once the customer has given real
      // holiday signal (destination/dates/pax/budget…), treat it as an enquiry
      // even if the model labels the turn intent="other" — it routinely does that
      // when it prematurely closes with "the team will call you", which must NOT
      // drop the enquiry on the floor. `beneficiaryActive` kept for clarity.
      const treatAsEnquiry = turn.intent === "enquiry" || hasSubstantiveSignal(mergedSlots) || beneficiaryActive;

      // Create trigger, computed up here so we can log the full decision state in
      // one place before branching. Fires once we're mid-collection AND either the
      // grouped follow-up was sent OR nothing's left worth asking.
      const missingBeforeCreate = missingFieldsFor(mergedSlots);
      const substantive = hasSubstantiveSignal(mergedSlots);
      const readyToCreate =
        enquiryStatus === "collecting" && (!!prevContext.groupedAskSent || missingBeforeCreate.length === 0);

      // One structured line capturing every input to the enquiry state machine —
      // so when creation doesn't happen we can see exactly why (which flag/branch).
      console.log(
        `[sendseven-webhook] conv=${conversationId} ENQUIRY-DECISION route=${route} intent=${turn.intent} ` +
          `status=${enquiryStatus} groupedAskSent=${!!prevContext.groupedAskSent} substantive=${substantive} ` +
          `treatAsEnquiry=${treatAsEnquiry} missing=${missingBeforeCreate.length}[${missingBeforeCreate.join("|")}] ` +
          `readyToCreate=${readyToCreate} beneficiary=${beneficiaryActive} enquiryClientId=${enquiryClientId ?? "null"} ` +
          `mergedSlots=${JSON.stringify(mergedSlots)} rawTurnSlots=${JSON.stringify(turn.slots)}`,
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

        const rawTime = message.text!.trim();
        const confirmReply = await generateTransitionReply(botConfig, kb, "callback_booked", rawTime, prevContext.onBehalfOfName);
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

      // Step: create the enquiry. Fires once we're mid-collection AND either the
      // ONE grouped follow-up has been sent OR there's nothing left worth asking
      // (a customer who front-loaded destination + dates + pax + budget shouldn't
      // be asked a pointless extra question). Creation is driven by the COLLECTED
      // DATA, not the model's intent label — the model often flips to intent
      // "other" while closing with "the team will call you", and that must still
      // create the enquiry. Guarded on enquiryStatus="collecting" (survives a
      // reset) and an atomic claim taken BEFORE the create so a retried/concurrent
      // inbound that loses the claim does nothing. (missingBeforeCreate /
      // readyToCreate / substantive computed + logged above.)
      if (readyToCreate) {
        if (!substantive) {
          // Nothing substantive to log (they declined / went off-topic with no
          // detail) — do not fabricate an enquiry; hand off instead.
          console.log(`[sendseven-webhook] conv ${conversationId} nothing substantive to log after ask — handing off instead of creating`);
          return doHandoff(turn.reply);
        }

        const claimed = await conversationStateRepository.claimStatusTransition(conversationId, "collecting", "awaiting_availability");
        if (!claimed) {
          console.log(`[sendseven-webhook] conv ${conversationId} lost the create-enquiry claim — already actioned, skipping`);
          return;
        }

        console.log(
          `[sendseven-webhook] conv ${conversationId} CREATING enquiry (clientId=${enquiryClientId ?? "null"}) from slots=${JSON.stringify(mergedSlots)}`,
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
        const askTimeReply = await generateTransitionReply(botConfig, kb, "ask_callback_time", undefined, onBehalfOfName);
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

      // Step: enquiry intent, grouped ask not yet sent.
      if (treatAsEnquiry) {
        if (!substantive) {
          // Soft anti-empty threshold not met — keep collecting naturally.
          console.log(`[sendseven-webhook] conv ${conversationId} BRANCH=collecting-thin (enquiry, not enough signal yet) — asking naturally`);
          update.intent = "enquiry";
          update.enquiryStatus = "collecting";
          update.enquirySlots = mergedSlots;
          await sendReply(orgId, conversationId, message.channel_id, turn.reply, mode, false);
          await conversationStateRepository.update(conversationId, update);
          return;
        }

        // Enough signal — send the ONE grouped follow-up for whatever's missing.
        console.log(`[sendseven-webhook] conv ${conversationId} BRANCH=grouped-ask (setting groupedAskSent=true, missing=${missingBeforeCreate.join("|")})`);
        const groupedReply = await generateGroupedAsk(botConfig, kb, missingBeforeCreate, transcript);
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
const GENERIC_TRAVELLER_RE =
  /^(?:(?:a|my|your|his|her|their|the)\s+)?(?:friend|mate|buddy|pal|someone|somebody|colleague|co-?worker|client|customer|person|people|guy|lady|companion|partner|other\s+half)$/i;
function cleanTravellerName(raw?: string): string | undefined {
  const v = (raw ?? "").trim();
  if (!v || GENERIC_TRAVELLER_RE.test(v)) return undefined;
  return v;
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
  const sentId = (sent as { id?: string } | null | undefined)?.id;
  if (sentId) await sendsevenWebhookRepository.markOurMessage(sentId, orgId);
}
