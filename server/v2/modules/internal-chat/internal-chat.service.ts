import OpenAI from "openai";
import { AppError } from "../../utils/error-handler";
import { CHAT_MODEL } from "../../utils/ai-model";
import { hasAnyRole, type Scope } from "../../utils/scope";
import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import type { EmbeddingMatch } from "../ai-embeddings/ai-embeddings.repository";
import {
  isStyleExampleCategory,
  buildStyleExamplesBlock,
  audienceAllows,
  parseBotRules,
  buildRulesBlock,
} from "../ai-conversation/ai-conversation.brain";
import { botConfigRepository } from "../bot-config/bot-config.repository";
import { knowledgeBaseRepository } from "../knowledge-base/knowledge-base.repository";
import { internalChatRepository } from "./internal-chat.repository";
import type { ChatMode } from "./internal-chat.types";
import type { InternalChatMessage, InternalChatSession, OrgBotConfig, OrgKnowledgeBase } from "@shared/schema";
import {
  internalChatAnalyticsService,
  resolveAnalyticsAccess,
  PIPELINE_PERIODS,
  type PipelinePeriod,
} from "./internal-chat-analytics.service";
import { internalChatClientsService, type ClientRecordType } from "./internal-chat-clients.service";
import { internalChatTestflowService } from "./internal-chat-testflow.service";

// Service: the in-system AI chatbot for staff.
//
// Goal A (implemented here): an org-wide assistant that answers staff
// questions using the org's bot persona + knowledge base + best-effort
// retrieved context (KB + past quotes). This is a LEAN, staff-facing prompt —
// not the customer-facing enquiry slot-filling flow (see
// sendseven-webhook/reply-worker.service.ts for that).
//
// test_flow (a staff-driven test of the customer enquiry flow) is scaffolded
// at the data/routing level only; the real driver is a later phase.

const HISTORY_LIMIT = 10;
const KB_CHAR_BUDGET = 4000;
const QUOTE_CHAR_BUDGET = 1200;
const TEST_FLOW_ROLES = ["org_admin", "platform_admin"] as const;
const TOOL_CALL_MAX_ITERATIONS = 4;
const PIPELINE_STATS_TOOL_NAME = "get_pipeline_stats";
const SEARCH_CLIENTS_TOOL_NAME = "search_clients";
const GET_CLIENT_DETAILS_TOOL_NAME = "get_client_details";
const GET_CLIENT_RECORDS_TOOL_NAME = "get_client_records";
const CLIENT_RECORD_TYPES = ["enquiries", "quotes", "bookings", "all"] as const;

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AppError("OpenAI API key is not configured", 503);
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// The ONE tool the assistant can call to answer data questions. It never
// receives or trusts any identity/scope info from the model — the executor
// (executePipelineStatsTool) always uses the caller's own server-side scope.
const pipelineStatsTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: PIPELINE_STATS_TOOL_NAME,
    description:
      "Returns REAL counts of enquiries, quotes, and bookings, and the enquiry-to-quote and quote-to-booking " +
      "conversion rates, for the given time period. The result is already scoped to exactly what the caller is " +
      "permitted to see (their own numbers, their branch's, or the whole org, depending on their role) — do not " +
      "add any further filtering or caveats about permissions beyond what the tool result states. Use this tool " +
      "for ANY question about how many enquiries/quotes/bookings there are, or about conversion rates — never " +
      "estimate, guess, or invent these figures yourself.",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: PIPELINE_PERIODS as unknown as string[],
          description: "The time window to report on.",
        },
        from: {
          type: "string",
          description: "ISO date (YYYY-MM-DD), inclusive start. Required (with 'to') when period is 'custom'.",
        },
        to: {
          type: "string",
          description: "ISO date (YYYY-MM-DD), inclusive end. Required (with 'from') when period is 'custom'.",
        },
      },
      required: ["period"],
      additionalProperties: false,
    },
  },
};

// Two more tools the assistant can call to answer "who is this client and
// what have they got with us" questions. Like pipelineStatsTool, they never
// receive or trust any identity/scope info from the model — the executors
// (executeSearchClientsTool / executeGetClientDetailsTool) always use the
// caller's own server-side scope, and the results are identity + pipeline-
// count only (never contact details or financial figures).
const searchClientsTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: SEARCH_CLIENTS_TOOL_NAME,
    description:
      "Find clients by name, email, or phone. Returns identity only (name, status, assigned agent) for clients " +
      "the caller is permitted to see. Use this to locate a client before get_client_details. Never guess client " +
      "identities.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A name, email, or phone fragment to search for.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

const getClientDetailsTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: GET_CLIENT_DETAILS_TOOL_NAME,
    description:
      "Returns a specific client's identity and pipeline summary (their enquiry/quote/booking counts + latest " +
      "activity), scoped to the caller's permissions. Does NOT return contact details or financials.",
    parameters: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The client's id, typically obtained from search_clients.",
        },
      },
      required: ["clientId"],
      additionalProperties: false,
    },
  },
};

const getClientRecordsTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: GET_CLIENT_RECORDS_TOOL_NAME,
    description:
      "Returns a specific client's enquiry, quote, and/or booking DETAILS (destinations, dates, status, refs, " +
      "and full financials incl. prices/values/commission) for a client the caller is permitted to see. Use " +
      "after search_clients/get_client_details when the colleague asks about a client's actual enquiries, " +
      "quotes, or bookings. Never invent details — always call this. The clientId MUST be a UUID you obtained " +
      "from search_clients or get_client_details in THIS conversation — NEVER invent, guess, or reuse a number " +
      "from elsewhere. If you don't already have the client's UUID, call search_clients first.",
    parameters: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The client's id, typically obtained from search_clients or get_client_details.",
        },
        type: {
          type: "string",
          enum: CLIENT_RECORD_TYPES as unknown as string[],
          description: "Which record type(s) to return. Defaults to 'all' if omitted.",
        },
      },
      required: ["clientId"],
      additionalProperties: false,
    },
  },
};

interface PipelineStatsToolArgs {
  period: PipelinePeriod;
  from?: string;
  to?: string;
}

function parsePipelineStatsArgs(rawArguments: string): PipelineStatsToolArgs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments || "{}");
  } catch {
    throw new AppError("Tool arguments were not valid JSON", 400);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new AppError("Tool arguments must be an object", 400);
  }
  const obj = parsed as Record<string, unknown>;
  const period = obj.period;
  if (typeof period !== "string" || !(PIPELINE_PERIODS as readonly string[]).includes(period)) {
    throw new AppError(`'period' must be one of ${PIPELINE_PERIODS.join(", ")}`, 400);
  }
  const from = typeof obj.from === "string" ? obj.from : undefined;
  const to = typeof obj.to === "string" ? obj.to : undefined;
  return { period: period as PipelinePeriod, from, to };
}

// Executes the tool call against the DB using the SESSION's own scope — the
// model only ever supplies period/from/to, never identity. Access is checked
// FIRST, before any query is issued: if the caller isn't permitted to see
// pipeline data (resolveAnalyticsAccess fails closed for referral_agent/
// social_media_manager/branch_manager-without-branch/agent-or-homeworker-
// without-userId/anything unrecognized), we never touch the DB and just
// hand the model a polite refusal reason to relay. Any other failure is
// likewise returned as a small { error } payload rather than thrown, so the
// model can relay it instead of the whole turn failing.
async function executePipelineStatsTool(
  scope: Scope,
  rawArguments: string,
): Promise<Record<string, unknown>> {
  const access = resolveAnalyticsAccess(scope);
  if (!access.allowed) {
    return { error: access.reason ?? "You don't have access to pipeline data." };
  }
  try {
    const args = parsePipelineStatsArgs(rawArguments);
    const answer = await internalChatAnalyticsService.getPipelineAnswer(scope, args.period, args.from, args.to);
    return { ...answer };
  } catch (err) {
    console.error("[internal-chat] get_pipeline_stats failed:", err);
    return { error: err instanceof AppError ? err.message : "Failed to compute pipeline stats" };
  }
}

interface SearchClientsToolArgs {
  query: string;
}

function parseSearchClientsArgs(rawArguments: string): SearchClientsToolArgs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments || "{}");
  } catch {
    throw new AppError("Tool arguments were not valid JSON", 400);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new AppError("Tool arguments must be an object", 400);
  }
  const obj = parsed as Record<string, unknown>;
  const query = obj.query;
  if (typeof query !== "string" || !query.trim()) {
    throw new AppError("'query' must be a non-empty string", 400);
  }
  return { query: query.trim() };
}

interface GetClientDetailsToolArgs {
  clientId: string;
}

function parseGetClientDetailsArgs(rawArguments: string): GetClientDetailsToolArgs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments || "{}");
  } catch {
    throw new AppError("Tool arguments were not valid JSON", 400);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new AppError("Tool arguments must be an object", 400);
  }
  const obj = parsed as Record<string, unknown>;
  const clientId = obj.clientId;
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new AppError("'clientId' must be a non-empty string", 400);
  }
  return { clientId: clientId.trim() };
}

// Executes search_clients using the SESSION's own scope — the model only
// ever supplies a search term, never identity. Access is resolved INSIDE
// internalChatClientsService.searchClients (fail-closed); a denial comes
// back as a small { error } payload for the model to relay, never a thrown
// error or a partial/guessed result.
async function executeSearchClientsTool(scope: Scope, rawArguments: string): Promise<Record<string, unknown>> {
  try {
    const args = parseSearchClientsArgs(rawArguments);
    const result = await internalChatClientsService.searchClients(scope, args.query);
    if (!result.allowed) return { error: result.reason };
    return { results: result.results };
  } catch (err) {
    console.error("[internal-chat] search_clients failed:", err);
    return { error: err instanceof AppError ? err.message : "Failed to search clients" };
  }
}

// Executes get_client_details using the SESSION's own scope — the model only
// ever supplies a clientId (normally one it got back from search_clients).
// Both the access check and the visibility-scoped id lookup happen inside
// internalChatClientsService.getClientDetails, so an out-of-scope or
// nonexistent id can never be distinguished by the model (both come back as
// the same "not found or not visible" message).
async function executeGetClientDetailsTool(scope: Scope, rawArguments: string): Promise<Record<string, unknown>> {
  try {
    const args = parseGetClientDetailsArgs(rawArguments);
    const result = await internalChatClientsService.getClientDetails(scope, args.clientId);
    if (!result.allowed) return { error: result.reason };
    if (!result.found) return { error: result.reason };
    return { identity: result.identity, pipeline: result.pipeline };
  } catch (err) {
    console.error("[internal-chat] get_client_details failed:", err);
    return { error: err instanceof AppError ? err.message : "Failed to get client details" };
  }
}

interface GetClientRecordsToolArgs {
  clientId: string;
  type: ClientRecordType;
}

function parseGetClientRecordsArgs(rawArguments: string): GetClientRecordsToolArgs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments || "{}");
  } catch {
    throw new AppError("Tool arguments were not valid JSON", 400);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new AppError("Tool arguments must be an object", 400);
  }
  const obj = parsed as Record<string, unknown>;
  const clientId = obj.clientId;
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new AppError("'clientId' must be a non-empty string", 400);
  }
  const type = obj.type;
  if (type !== undefined && (typeof type !== "string" || !(CLIENT_RECORD_TYPES as readonly string[]).includes(type))) {
    throw new AppError(`'type' must be one of ${CLIENT_RECORD_TYPES.join(", ")}`, 400);
  }
  return { clientId: clientId.trim(), type: (type as ClientRecordType | undefined) ?? "all" };
}

// Executes get_client_records using the SESSION's own scope — the model only
// ever supplies a clientId (normally one it got from search_clients/
// get_client_details) and an optional type filter. Both the access check and
// the visibility-scoped id lookup happen inside
// internalChatClientsService.getClientRecords, so an out-of-scope or
// nonexistent id can never be distinguished by the model.
async function executeGetClientRecordsTool(scope: Scope, rawArguments: string): Promise<Record<string, unknown>> {
  try {
    const args = parseGetClientRecordsArgs(rawArguments);
    const result = await internalChatClientsService.getClientRecords(scope, args.clientId, args.type);
    if (!result.allowed) return { error: result.reason };
    if (!result.found) return { error: result.reason };
    return {
      enquiries: result.enquiries,
      quotes: result.quotes,
      bookings: result.bookings,
    };
  } catch (err) {
    console.error("[internal-chat] get_client_records failed:", err);
    return { error: err instanceof AppError ? err.message : "Failed to get client records" };
  }
}

// Best-effort read of a retrieved match's `category` from its metadata jsonb.
function metaCategory(meta: unknown): string | null {
  if (meta && typeof meta === "object" && "category" in meta) {
    const c = (meta as Record<string, unknown>).category;
    return typeof c === "string" ? c : null;
  }
  return null;
}

// Best-effort read of a retrieved match's `audience` from its metadata jsonb.
function metaAudience(meta: unknown): string | null {
  if (meta && typeof meta === "object" && "audience" in meta) {
    const a = (meta as Record<string, unknown>).audience;
    return typeof a === "string" ? a : null;
  }
  return null;
}

// Client identities discovered via the client tools this session. The
// tool-call turns themselves are NOT persisted (getRecentMessages only replays
// user/assistant text), so the ids the model found via search_clients are lost
// on the next turn — a colleague saying "yes, that one" a turn later would
// leave the model with no UUID to pass to get_client_records (it then guesses,
// and findClientById rejects the non-UUID as "not found"). We cache the
// {id,name} pairs on the session context and surface them back into the next
// turn's prompt so the model reuses the exact id.
interface KnownClient {
  id: string;
  name: string;
}
const KNOWN_CLIENTS_LIMIT = 10;

function isKnownClient(v: unknown): v is KnownClient {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { id?: unknown }).id === "string" &&
    typeof (v as { name?: unknown }).name === "string"
  );
}

function readKnownClients(session: InternalChatSession): KnownClient[] {
  const list = (session.context as { knownClients?: unknown } | null)?.knownClients;
  return Array.isArray(list) ? list.filter(isKnownClient) : [];
}

// Pulls {id,name} pairs a tool result exposed — search_clients `results[]` and
// get_client_details `identity` both carry them.
function extractClientsFromToolResult(result: unknown): KnownClient[] {
  if (!result || typeof result !== "object") return [];
  const obj = result as Record<string, unknown>;
  const out: KnownClient[] = [];
  if (Array.isArray(obj.results)) {
    for (const r of obj.results) if (isKnownClient(r)) out.push({ id: r.id, name: r.name });
  }
  if (isKnownClient(obj.identity)) out.push({ id: obj.identity.id, name: obj.identity.name });
  return out;
}

// Newest-first dedupe by id, capped — discovered pairs win over prior.
function mergeKnownClients(prior: KnownClient[], discovered: KnownClient[]): KnownClient[] {
  const byId = new Map<string, string>();
  for (const c of [...discovered, ...prior]) if (!byId.has(c.id)) byId.set(c.id, c.name);
  return Array.from(byId, ([id, name]) => ({ id, name })).slice(0, KNOWN_CLIENTS_LIMIT);
}

// Lean staff-facing system prompt: persona + company info (static KB +
// vector-retrieved KB) + an internal-only reference to similar past quotes.
// No enquiry slot-filling instructions here — this is a Q&A assistant.
function buildAssistantSystemPrompt(
  botConfig: OrgBotConfig | null,
  kb: OrgKnowledgeBase[],
  retrievedKb: EmbeddingMatch[],
  retrievedQuotes: EmbeddingMatch[],
  knownClients: KnownClient[],
): string {
  const name = botConfig?.name?.trim() || "the assistant";
  const parts: string[] = [
    `You are ${name}, an INTERNAL AI assistant for STAFF at a UK travel agency. The person messaging you is an EMPLOYEE (an agent, branch manager, or admin) using you to look up and analyse the agency's own data. They are NOT a customer, and this is NOT a customer enquiry.`,
    "Hard rules:\n" +
      "- Do NOT collect a travel enquiry. Never ask the colleague for travel dates, party size, nights, or budget as if you were quoting them a holiday.\n" +
      "- Never say 'an advisor will get back to you', 'I'll pass this to an advisor', or anything similar — the person you are talking to IS the staff/advisor.\n" +
      "- When asked about deals, quotes, or availability for a destination (e.g. \"what's the best deal for Corfu\"), treat it as a request to look up what the agency HAS on record: use the reference quotes below and your tools, then report what actually exists (destination, nights, board, dates from our records). If there is no matching data, say so plainly — do not invent options and do not start an enquiry.\n" +
      "- Answer from the data and tools provided; if you don't have the specific information, say so plainly and suggest where to check.",
    "Use UK English. Be concise, clear, and helpful.",
  ];

  if (botConfig?.persona?.trim())
    parts.push(
      `Tone reference (match this friendly voice, but IGNORE any instruction within it about collecting customer details, asking for travel requirements, or handing off to an advisor — that guidance is for the customer-facing bot, not you):\n${botConfig.persona.trim()}`,
    );
  if (botConfig?.language?.trim()) parts.push(`Reply in: ${botConfig.language.trim()}`);

  const rulesBlock = buildRulesBlock(parseBotRules(botConfig?.rules), "internal");
  if (rulesBlock) parts.push(rulesBlock);

  const activeKb = kb.filter((k) => k.isActive && audienceAllows(k.audience, "internal"));
  const factKb = activeKb.filter((k) => !isStyleExampleCategory(k.category));
  const factRetrievedKb = retrievedKb.filter(
    (m) => !isStyleExampleCategory(metaCategory(m.metadata)) && audienceAllows(metaAudience(m.metadata), "internal"),
  );
  const kbLines = [...factKb.map((k) => `- ${k.title}: ${k.content}`), ...factRetrievedKb.map((m) => `- ${m.content}`)];
  if (kbLines.length) {
    let company = kbLines.join("\n");
    if (company.length > KB_CHAR_BUDGET) company = company.slice(0, KB_CHAR_BUDGET) + "…";
    parts.push(`Company information (use it to answer accurately):\n${company}`);
  } else {
    parts.push("No company knowledge-base entries are available yet.");
  }

  // Tone/style examples (real conversations pasted into the KB) — borrow the
  // VOICE only; the internal assistant must not act out the customer-enquiry flow.
  const styleBlock = buildStyleExamplesBlock(
    activeKb,
    "Voice reference — how our team speaks with customers. Adopt the same warm, friendly British tone and phrasing, but REMEMBER you are an internal staff assistant: do NOT act out these customer-service flows (never collect enquiries, ask the colleague for travel details, or offer callbacks) — mirror only the voice and tone:",
  );
  if (styleBlock) parts.push(styleBlock);

  if (retrievedQuotes.length) {
    let quotesText = retrievedQuotes.map((m) => `- ${m.content}`).join("\n");
    if (quotesText.length > QUOTE_CHAR_BUDGET) quotesText = quotesText.slice(0, QUOTE_CHAR_BUDGET) + "…";
    parts.push(
      "Similar past quotes from our records (you may share the relevant details with the colleague to answer their question; " +
        `note that prices are not included in this reference):\n${quotesText}`,
    );
  }

  parts.push(
    `For ANY question about counts of enquiries, quotes, or bookings, or about conversion rates (enquiry-to-quote, quote-to-booking), ALWAYS call the "${PIPELINE_STATS_TOOL_NAME}" tool — never estimate or make these numbers up. Pick the "period" that matches what was asked (default to "this_month" if unclear); use "custom" with explicit from/to dates only when the colleague gives a specific date range. ` +
      'The tool result includes a "scopeLevel" field ("own", "branch", "org", or "all") — always state in your answer whose numbers you are reporting (e.g. "your own numbers", "your branch\'s numbers", "org-wide numbers") based on that field, and state the period covered. If any count is 0, say so plainly rather than implying you don\'t know.',
  );

  parts.push(
    `For questions about a specific client — "who is client X", "what has this client got with us", or similar — ` +
      `use the "${SEARCH_CLIENTS_TOOL_NAME}" tool to find them by name/email/phone, then the ` +
      `"${GET_CLIENT_DETAILS_TOOL_NAME}" tool (with the id it returns) to get their identity and pipeline summary ` +
      "(enquiry/quote/booking counts and latest activity). When the colleague asks about a client's ACTUAL " +
      `enquiries, quotes, or bookings (destinations, dates, status, refs, prices, or commission), use the ` +
      `"${GET_CLIENT_RECORDS_TOOL_NAME}" tool (with the same client id) instead — it returns itemized details ` +
      "including full financials (sales price, package commission, discounts, service charge). You MAY share " +
      "those prices/values/commission figures with the colleague — this is staff-facing financial data, not a " +
      "customer-facing disclosure. The client id is a UUID: you MUST obtain it from search_clients (or " +
      "get_client_details) in THIS conversation before calling get_client_details or get_client_records — on a new " +
      "question about a client, call search_clients again to get their exact id; NEVER invent an id, guess one, or " +
      "reuse a number from elsewhere. Never guess or invent a client's identity, history, or figures — always look " +
      "it up via these tools. If a search returns more than one plausible match, ask the colleague which one they " +
      "mean rather than picking one yourself. These tools only return what the caller is permitted to see — if a " +
      "lookup is denied or a client isn't found/visible, relay that plainly rather than working around it. " +
      "IMPORTANT: even if asked directly, NEVER reveal a client's CONTACT details (email, phone, address) — none " +
      "of these tools return them, and you don't have them from any other source either; say you're not able to " +
      "share that.",
  );

  if (knownClients.length) {
    parts.push(
      "Clients already identified earlier in THIS conversation — when the colleague refers back to one of them " +
        '("that one", "this client", "him/her", or by name), reuse the EXACT id shown here for get_client_details / ' +
        "get_client_records rather than guessing or passing a name, and you do NOT need to search again for these:\n" +
        knownClients.map((c) => `- ${c.name} [id: ${c.id}]`).join("\n"),
    );
  }

  parts.push(
    "Answer using ONLY the information above plus general travel-industry knowledge to help with day-to-day questions. If you don't have the specific information needed, say so plainly rather than guessing, and suggest who or where to check.",
  );
  return parts.join("\n\n");
}

export type PostMessageResult =
  | { kind: "assistant_reply"; message: InternalChatMessage }
  | { kind: "test_flow_pending"; reply: string };

export const internalChatService = {
  // Creating a test_flow session is gated to org_admin/platform_admin — done
  // here (not a route middleware) because the gate depends on the body's
  // `mode`. `assistant` is open to any authenticated org member.
  async createSession(scope: Scope, mode: ChatMode): Promise<InternalChatSession> {
    if (mode === "test_flow" && !hasAnyRole(scope.orgRoles, [...TEST_FLOW_ROLES])) {
      throw new AppError("Only an org admin can start a test flow session", 403);
    }
    return internalChatRepository.createSession({ orgId: scope.orgId, userId: scope.userId, mode });
  },

  // Loads the session, 404ing if it doesn't exist OR belongs to another org —
  // never leaks cross-org existence.
  async getSessionForCaller(scope: Scope, sessionId: string): Promise<InternalChatSession> {
    const session = await internalChatRepository.findByIdForOrg(sessionId, scope.orgId);
    if (!session) throw new AppError("Chat session not found", 404);
    return session;
  },

  async postMessage(scope: Scope, sessionId: string, text: string): Promise<PostMessageResult> {
    const trimmed = (text || "").trim();
    if (!trimmed) throw new AppError("Message text is required", 400);
    const session = await this.getSessionForCaller(scope, sessionId);

    if (session.mode === "test_flow") {
      // Replays the SendSeven client-conversation flow against the internal_chat
      // tables using a synthetic client (see internal-chat-testflow.service.ts).
      // The driver persists both the user's turn and the reply itself.
      const { replyMessage } = await internalChatTestflowService.runTestFlowTurn(session, trimmed, scope);
      return { kind: "assistant_reply", message: replyMessage };
    }

    const message = await this.answer(scope, session, trimmed);
    return { kind: "assistant_reply", message };
  },

  async listMessages(scope: Scope, sessionId: string): Promise<InternalChatMessage[]> {
    await this.getSessionForCaller(scope, sessionId);
    return internalChatRepository.listBySession(sessionId, scope.orgId);
  },

  // Goal A: the org-wide assistant turn. Persists the user message, gathers
  // org context (best-effort retrieval never throws), then runs a
  // tool-calling loop with gpt-4o so data questions (enquiry/quote/booking
  // counts + conversion rates) are answered from a real, scope-aware DB
  // query rather than the model's own guess. Persists and returns the reply.
  async answer(scope: Scope, session: InternalChatSession, userText: string): Promise<InternalChatMessage> {
    const orgId = session.orgId;
    await internalChatRepository.createMessage({ sessionId: session.id, role: "user", content: userText });

    const [botConfig, kb, kbMatches, quoteMatches, history] = await Promise.all([
      botConfigRepository.findByOrg(orgId),
      knowledgeBaseRepository.list(orgId),
      aiEmbeddingsService.retrieve({ orgId, sourceType: "knowledge", query: userText, limit: 4 }),
      aiEmbeddingsService.retrieve({ orgId, sourceType: "quote", query: userText, limit: 4 }),
      internalChatRepository.getRecentMessages(session.id, orgId, HISTORY_LIMIT),
    ]);

    const knownClients = readKnownClients(session);
    const systemPrompt = buildAssistantSystemPrompt(botConfig, kb, kbMatches, quoteMatches, knownClients);
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : m.role === "system_note" ? "system" : "user") as
          | "system"
          | "user"
          | "assistant",
        content: m.content,
      })),
    ];

    const openai = getOpenAI();
    // Client {id,name} pairs surfaced by the tools this turn — persisted below
    // so the ids survive to the next turn (the tool turns themselves are not).
    const discovered: KnownClient[] = [];
    let raw: string | undefined;
    try {
      for (let iteration = 0; iteration < TOOL_CALL_MAX_ITERATIONS; iteration += 1) {
        const response = await openai.chat.completions.create({
          model: CHAT_MODEL,
          temperature: 0.4,
          max_tokens: 800,
          messages: chatMessages,
          tools: [pipelineStatsTool, searchClientsTool, getClientDetailsTool, getClientRecordsTool],
        });
        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) break;

        const toolCalls = assistantMessage.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
          raw = assistantMessage.content?.trim();
          break;
        }

        // Record the model's tool-call turn, then execute every requested
        // call against the DB using the CALLER's own scope (never anything
        // the model supplies) before looping back for the model's final answer.
        chatMessages.push({
          role: "assistant",
          content: assistantMessage.content ?? null,
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          const toolResult =
            toolCall.type === "function" && toolCall.function.name === PIPELINE_STATS_TOOL_NAME
              ? await executePipelineStatsTool(scope, toolCall.function.arguments)
              : toolCall.type === "function" && toolCall.function.name === SEARCH_CLIENTS_TOOL_NAME
                ? await executeSearchClientsTool(scope, toolCall.function.arguments)
                : toolCall.type === "function" && toolCall.function.name === GET_CLIENT_DETAILS_TOOL_NAME
                  ? await executeGetClientDetailsTool(scope, toolCall.function.arguments)
                  : toolCall.type === "function" && toolCall.function.name === GET_CLIENT_RECORDS_TOOL_NAME
                    ? await executeGetClientRecordsTool(scope, toolCall.function.arguments)
                    : { error: "Unknown tool" };
          discovered.push(...extractClientsFromToolResult(toolResult));
          chatMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
      }

      // The loop can end with tool results appended but no final
      // natural-language answer yet — e.g. the model still returned
      // tool_calls on the very last iteration. Force one final answer-only
      // turn (tool_choice: "none") so the model must respond in text using
      // the tool results already in the transcript, instead of failing the
      // whole request with a 502.
      if (!raw) {
        const finalResponse = await openai.chat.completions.create({
          model: CHAT_MODEL,
          temperature: 0.4,
          max_tokens: 800,
          messages: chatMessages,
          tool_choice: "none",
        });
        raw = finalResponse.choices[0]?.message?.content?.trim();
      }
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : "Failed to reach the AI service", 502);
    }
    if (!raw) throw new AppError("The AI returned an empty response", 502);

    // Persist any client ids surfaced this turn so a follow-up ("that one",
    // "his latest enquiry") can reuse the exact UUID instead of guessing.
    if (discovered.length) {
      const priorCtx = (session.context as Record<string, unknown> | null) ?? {};
      await internalChatRepository.updateSession(session.id, orgId, {
        context: { ...priorCtx, knownClients: mergeKnownClients(knownClients, discovered) },
      });
    }

    return internalChatRepository.createMessage({ sessionId: session.id, role: "assistant", content: raw });
  },
};
