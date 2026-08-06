import { AppError } from "../../utils/error-handler";
import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import { buildTranscript, generateTurn, hasSubstantiveSignal, kbExceedsBudget } from "../ai-conversation/ai-conversation.brain";
import { botConfigRepository } from "../bot-config/bot-config.repository";
import { conversationsRepository } from "../conversations/conversations.repository";
import { knowledgeBaseRepository } from "../knowledge-base/knowledge-base.repository";
import { messagesRepository } from "../messages/messages.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { conversationStateRepository } from "./conversation-state.repository";
import { hydrateDealReplyContext, type DealRef } from "./deal-context.service";
import { systemScope } from "./identity.service";
import type { EnquirySlots, RetrievedContext, RetrievedMatch } from "../ai-conversation/ai-conversation.types";

// On-demand AI reply suggestion for the inbox composer ("AI reply" button):
// an agent asks for a draft, the AI reads the same context the live bot would
// (recent transcript, linked client or SendSeven contact name, enquiry
// status/slots, bot persona/rules/KB) and returns REPLY TEXT ONLY.
//
// Deliberately SIDE-EFFECT-FREE — this is a writing assistant, not a bot turn:
// no state writes, no enquiry/ticket/task creation, no messages sent, no
// AI-state changes. The agent edits the text in the composer and presses send
// themselves (which pauses the live AI via the normal staff-send path). That's
// also why it works on ANY conversation regardless of hand-off/opt-in state.
//
// Callers must run inside a request that has the org's SendSeven config bound
// (the sendSevenContext middleware on /conversations does this).

const HISTORY_LIMIT = 20;

export async function suggestAiReply(orgId: string, conversationId: string, userId?: string | null): Promise<string> {
  // The state row (if any) is org-stamped — reject a cross-org id outright. A
  // conversation with no state row is still fine: the message fetch below runs
  // against THIS org's SendSeven workspace, so a foreign id just 404s there.
  const state = await conversationStateRepository.find(conversationId);
  if (state && state.orgId !== orgId) throw new AppError("Conversation not found", 404);

  const [botConfig, kb, list, conv] = await Promise.all([
    botConfigRepository.findByOrg(orgId),
    knowledgeBaseRepository.list(orgId),
    messagesRepository.list({ conversationId, page: 1, pageSize: HISTORY_LIMIT }),
    // Contact name is a nicety — its fetch failing must not fail the suggestion.
    conversationsRepository.getById(conversationId).catch(() => null),
  ]);

  // Internal notes (drafts, hand-off markers) and empty/attachment-only
  // messages are excluded — same transcript shape the live bot reads.
  // buildTranscript sorts by created_at itself.
  const usable = (Array.isArray(list.items) ? list.items : []).filter((m) => !m.is_internal && m.text?.trim());
  if (!usable.length) throw new AppError("Nothing in this conversation to reply to yet", 400);
  const latestInbound = [...usable].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")).reverse()
    .find((m) => m.direction === "inbound");
  const transcript = buildTranscript(usable, latestInbound?.text?.trim() ?? "");

  const client = state?.clientId
    ? await neonClientService.getNeonClientById(state.clientId, systemScope(orgId)).catch(() => null)
    : null;
  const rawName = (conv?.contact as { name?: unknown } | null | undefined)?.name;
  const contactName = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;

  // Current enquiry state feeds the prompt so the suggestion continues the
  // flow sensibly — but nothing the model returns (slots, intent, hand_off)
  // is persisted or acted on; only the reply text leaves this function.
  const slots = (state?.enquirySlots as EnquirySlots | null) ?? {};

  // Same best-effort vector retrieval (and the same gating) as the live sales
  // bot, so a suggestion is built from the same context the bot would have:
  // KB matches only when the static KB overflows the prompt budget, quote
  // matches only once the conversation looks enquiry-ish. Read-only — a
  // retrieval failure just means a leaner prompt, never a failed suggestion.
  const latestText = latestInbound?.text?.trim() ?? "";
  const enquiryish =
    state?.enquiryStatus === "collecting" || state?.enquiryStatus === "awaiting_availability" || hasSubstantiveSignal(slots);
  const [kbMatches, quoteMatches] = await Promise.all([
    kbExceedsBudget(kb)
      ? aiEmbeddingsService
          .retrieve({ orgId, sourceType: "knowledge", query: latestText, limit: 3, audience: "sales" })
          .catch(() => [] as RetrievedMatch[])
      : Promise.resolve([] as RetrievedMatch[]),
    enquiryish
      ? aiEmbeddingsService
          .retrieve({ orgId, sourceType: "quote", query: `${latestText} ${JSON.stringify(slots)}`, limit: 4 })
          .catch(() => [] as RetrievedMatch[])
      : Promise.resolve([] as RetrievedMatch[]),
  ]);
  // Pinned Facebook deal: read the live bot's pin (context.dealRef) and
  // hydrate it read-only, so the suggestion can quote the same posted deal
  // details the bot would. No pinning happens here — this path stays
  // side-effect-free — so a conversation the bot never processed simply has
  // no deal block.
  const dealRef = (state?.context as { dealRef?: DealRef } | null)?.dealRef ?? null;
  const deal = dealRef ? await hydrateDealReplyContext(dealRef) : null;
  const retrieved: RetrievedContext = { kb: kbMatches, quotes: quoteMatches, deal };

  const turn = await generateTurn(
    botConfig,
    kb,
    client,
    transcript,
    state?.enquiryStatus ?? null,
    slots,
    !!client,
    retrieved,
    { orgId, feature: "staff_chat", userId: userId ?? undefined },
    contactName,
  );
  return turn.reply;
}
