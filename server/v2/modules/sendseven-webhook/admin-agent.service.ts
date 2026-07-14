import OpenAI from "openai";
import { CHAT_MODEL } from "../../utils/ai-model";
import { getOpenAI, buildStyleExamplesBlock, isStyleExampleCategory } from "../ai-conversation/ai-conversation.brain";
import { adminDataService, type PendingAttachment } from "./admin-data.service";
import type { NeonClient, OrgBotConfig, OrgKnowledgeBase } from "@shared/schema";

// The admin bot: a CUSTOMER-FACING tool-calling agent that answers an
// EXISTING, verified client's questions about their own quotes, documents,
// and support tickets. Models the tool-calling loop shape on
// internal-chat.service.ts (iterate up to N times, append assistant
// tool_calls + tool results, then a final tool_choice:"none" turn to force a
// text answer) — but every tool executor closes over the SERVER-RESOLVED
// (orgId, clientId); the model never supplies or influences identity.

const KB_CHAR_BUDGET = 3000;
const TOOL_CALL_MAX_ITERATIONS = 4;
const GET_MY_QUOTES_TOOL_NAME = "get_my_quotes";
const GET_MY_TICKETS_TOOL_NAME = "get_my_tickets";
const GET_MY_FILES_TOOL_NAME = "get_my_files";
const GET_MY_FILE_LINK_TOOL_NAME = "get_my_file_link";
const GET_MY_ENQUIRIES_TOOL_NAME = "get_my_enquiries";
const OPEN_TICKET_TOOL_NAME = "open_ticket";
const TICKET_TYPES = ["Admin", "Build", "Sales"] as const;
const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

const getMyQuotesTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: GET_MY_QUOTES_TOOL_NAME,
    description:
      "Returns THIS customer's own quotes (status, destination, resort, board basis, travel date, nights, party size, and price). Use this for any question about the status of their quote/holiday booking. Never guess or invent quote details — always call this.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

const getMyTicketsTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: GET_MY_TICKETS_TOOL_NAME,
    description:
      "Returns THIS customer's own support tickets (subject, status, priority, dates). Use this for any question about a support ticket or complaint they have raised.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

const getMyFilesTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: GET_MY_FILES_TOOL_NAME,
    description:
      "Returns a list of THIS customer's own documents/files on record (title, category, original filename, date added) — e.g. tickets, invoices, booking confirmations. Use this to check what documents exist before offering to send one.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

const getMyFileLinkTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: GET_MY_FILE_LINK_TOOL_NAME,
    description:
      "Returns a short-lived download link for ONE of this customer's own documents. Only call this after the customer has explicitly asked to be sent/resent a document AND you have confirmed which one (using an id you got from get_my_files) — never guess the fileId.",
    parameters: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "The document's id, obtained from get_my_files.",
        },
      },
      required: ["fileId"],
      additionalProperties: false,
    },
  },
};

const getMyEnquiriesTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: GET_MY_ENQUIRIES_TOOL_NAME,
    description:
      "Returns THIS customer's own holiday enquiries they've submitted (destination, holiday type, travel date, party size, budget, status). Use this when the customer asks about the status of an enquiry they've made.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

const openTicketTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: OPEN_TICKET_TOOL_NAME,
    description:
      "Opens a SUPPORT TICKET for THIS customer so a member of staff follows up. Use this when the customer needs something actioned by a person that you cannot do yourself — e.g. they've sent a document (passport, insurance, etc.), are providing details you asked for, want to amend or cancel a booking, report a problem/complaint, or ask for a callback / for someone to get in touch. ALWAYS open a ticket before promising the customer that a colleague will call or follow up. Any file the customer sent in this message is attached to the ticket automatically. Do NOT use it for questions you can already answer with the other tools, and do NOT open duplicate tickets for the same request. Always confirm briefly with the customer what you're logging.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "A short, specific summary of the request (e.g. 'Passport document submitted', 'Amend booking dates').",
        },
        description: {
          type: "string",
          description: "A fuller description of what the customer wants, in their own words where useful, so staff have full context.",
        },
        type: {
          type: "string",
          enum: TICKET_TYPES as unknown as string[],
          description: "Ticket type. Use 'Admin' for document/account/amendment requests (the usual case), 'Sales' for a sales matter, 'Build' for a build task.",
        },
        priority: {
          type: "string",
          enum: TICKET_PRIORITIES as unknown as string[],
          description: "Urgency. Default to 'Medium' unless the customer indicates it's urgent.",
        },
      },
      required: ["subject"],
      additionalProperties: false,
    },
  },
};

function parseFileIdArg(rawArguments: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments || "{}");
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const fileId = (parsed as Record<string, unknown>).fileId;
  return typeof fileId === "string" && fileId.trim() ? fileId.trim() : null;
}

async function executeGetMyQuotesTool(orgId: string, clientId: string): Promise<Record<string, unknown>> {
  try {
    const quotes = await adminDataService.getQuotes(orgId, clientId);
    return { quotes };
  } catch (err) {
    console.error("[admin-agent] get_my_quotes failed:", err);
    return { error: "Failed to fetch quotes" };
  }
}

async function executeGetMyTicketsTool(orgId: string, clientId: string): Promise<Record<string, unknown>> {
  try {
    const tickets = await adminDataService.getTickets(orgId, clientId);
    return { tickets };
  } catch (err) {
    console.error("[admin-agent] get_my_tickets failed:", err);
    return { error: "Failed to fetch tickets" };
  }
}

async function executeGetMyFilesTool(clientId: string): Promise<Record<string, unknown>> {
  try {
    const files = await adminDataService.getFiles(clientId);
    return { files };
  } catch (err) {
    console.error("[admin-agent] get_my_files failed:", err);
    return { error: "Failed to fetch files" };
  }
}

async function executeGetMyEnquiriesTool(orgId: string, clientId: string): Promise<Record<string, unknown>> {
  try {
    const enquiries = await adminDataService.getEnquiries(orgId, clientId);
    return { enquiries };
  } catch (err) {
    console.error("[admin-agent] get_my_enquiries failed:", err);
    return { error: "Failed to fetch enquiries" };
  }
}

interface OpenTicketArgs {
  subject: string;
  description?: string;
  type?: string;
  priority?: string;
}

function parseOpenTicketArgs(rawArguments: string): OpenTicketArgs | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments || "{}");
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const subject = typeof obj.subject === "string" ? obj.subject.trim() : "";
  if (!subject) return null;
  return {
    subject,
    description: typeof obj.description === "string" ? obj.description : undefined,
    type: typeof obj.type === "string" ? obj.type : undefined,
    priority: typeof obj.priority === "string" ? obj.priority : undefined,
  };
}

// Files a ticket for the SERVER-RESOLVED (orgId, clientId) — the model supplies
// only the subject/description/type/priority, never the client identity. Any
// files the customer sent this turn (`attachments`) are attached to the new
// ticket, not the client's files.
async function executeOpenTicketTool(
  orgId: string,
  clientId: string,
  rawArguments: string,
  attachments: PendingAttachment[],
): Promise<Record<string, unknown>> {
  const args = parseOpenTicketArgs(rawArguments);
  if (!args) return { error: "'subject' is required to open a ticket." };
  try {
    const ticket = await adminDataService.createTicket(orgId, clientId, { ...args, attachments });
    if (!ticket) return { error: "Couldn't open the ticket right now — a colleague will follow up instead." };
    return { created: true, ticketId: ticket.id, subject: ticket.subject, status: ticket.status, attachedFiles: ticket.attachedCount };
  } catch (err) {
    console.error("[admin-agent] open_ticket failed:", err);
    return { error: "Couldn't open the ticket right now — a colleague will follow up instead." };
  }
}

async function executeGetMyFileLinkTool(clientId: string, rawArguments: string): Promise<Record<string, unknown>> {
  const fileId = parseFileIdArg(rawArguments);
  if (!fileId) return { error: "'fileId' must be a non-empty string, obtained from get_my_files" };
  try {
    const url = await adminDataService.getFileLink(clientId, fileId);
    if (!url) return { error: "That document isn't available on your account, or the link couldn't be generated right now." };
    return { url };
  } catch (err) {
    console.error("[admin-agent] get_my_file_link failed:", err);
    return { error: "Failed to generate a link for that document" };
  }
}

function buildAdminSystemPrompt(botConfig: OrgBotConfig | null, kb: OrgKnowledgeBase[], clientRecord: NeonClient | null): string {
  const name = botConfig?.name?.trim() || "the assistant";
  const clientName =
    [clientRecord?.title, clientRecord?.firstName, clientRecord?.surename].filter(Boolean).join(" ").trim() || "the customer";

  const parts: string[] = [
    `You are ${name}, an AI assistant replying to an EXISTING customer of a UK travel agency. You are speaking with ${clientName}.`,
    `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    "Use UK English. Write in the warm, natural, conversational voice of a friendly UK high-street travel agent — relaxed and human, never robotic or corporate. Continue the conversation naturally — do NOT re-greet the customer or open with 'hi'/'hey there'/'thanks for reaching out'.",
    "Hard rules:\n" +
      "- Answer ONLY questions about THIS customer's OWN quotes, enquiries, documents/files, and support tickets, using the tools provided.\n" +
      "- NEVER reveal agency commission, margin, discounts, or internal costs — none of the tools return them anyway. You MAY tell the customer their own quote status, destination, travel dates, and price.\n" +
      "- If the answer isn't in the tool results, say so plainly and offer to have a human colleague follow up — do NOT guess or invent quote/ticket/file details.\n" +
      "- Do NOT collect a new holiday enquiry here — if the customer asks about a brand-new holiday/deal, say a colleague will pick that up, and do not attempt to gather enquiry details yourself.\n" +
      "- Only call get_my_file_link once the customer has explicitly asked to be sent/resent a specific document and you've confirmed which one.\n" +
      "- When the customer needs something a person must action that you can't do yourself — they've sent a document (e.g. a passport photo), are PROVIDING personal/verification/booking details you were asked for (an ID/passport/reference/policy/account number, date of birth, etc.), want to amend/cancel a booking, have a problem/complaint, or ask for a callback / to speak to someone / for the team to get in touch — use open_ticket to log it for staff. Put the EXACT details they gave (e.g. the ID/reference number, verbatim) in the ticket description so the colleague has them, and if they gave a preferred callback time (e.g. \"anytime today\", \"after 5pm\") include that too. Any file they sent in this message is attached to that ticket automatically; a colleague reviews it (do NOT claim to have checked or verified the document/details yourself). Don't open a ticket for something you can already answer with the other tools, and don't open duplicates.\n" +
      "- CRITICAL: NEVER tell the customer that a colleague / the team / an advisor will call, follow up, or be in touch UNLESS you have actually opened a ticket (open_ticket) this turn to make that happen. No empty promises — if follow-up is needed, log it first, then confirm.",
  ];

  if (botConfig?.persona?.trim()) parts.push(`Tone: ${botConfig.persona.trim()}`);
  if (botConfig?.greeting?.trim()) parts.push(`Greeting style (do NOT re-greet mid-conversation, but match this voice): ${botConfig.greeting.trim()}`);
  if (botConfig?.signOff?.trim()) parts.push(`Sign-off: ${botConfig.signOff.trim()}`);
  if (botConfig?.language?.trim()) parts.push(`Reply in: ${botConfig.language.trim()}`);

  const activeKb = kb.filter((k) => k.isActive);
  const factKb = activeKb.filter((k) => !isStyleExampleCategory(k.category));
  if (factKb.length) {
    let company = factKb.map((k) => `- ${k.title}: ${k.content}`).join("\n");
    if (company.length > KB_CHAR_BUDGET) company = company.slice(0, KB_CHAR_BUDGET) + "…";
    parts.push(`Company information (use it to answer accurately):\n${company}`);
  }

  const styleBlock = buildStyleExamplesBlock(
    activeKb,
    "Match the tone, warmth and phrasing of these example conversations:",
  );
  if (styleBlock) parts.push(styleBlock);

  parts.push(
    `Use "${GET_MY_QUOTES_TOOL_NAME}" for questions about the status/details of their quote or holiday booking, "${GET_MY_ENQUIRIES_TOOL_NAME}" for questions about an enquiry they've submitted, "${GET_MY_TICKETS_TOOL_NAME}" for support ticket questions, "${GET_MY_FILES_TOOL_NAME}" to see what documents exist, "${GET_MY_FILE_LINK_TOOL_NAME}" only once they've explicitly asked to be sent/resent a confirmed document, and "${OPEN_TICKET_TOOL_NAME}" to log a request that needs a staff member to action (documents submitted, amendments, complaints).`,
  );

  return parts.join("\n\n");
}

export const adminAgent = {
  // Returns the reply text, or null on hard failure so the worker can hand
  // off to a human instead of sending nothing / an error.
  async answer(
    orgId: string,
    clientId: string,
    botConfig: OrgBotConfig | null,
    kb: OrgKnowledgeBase[],
    transcript: string,
    clientRecord: NeonClient | null,
    // A server-built note about file(s) the customer just sent this turn.
    // Attachments aren't part of the text transcript, so this is how the bot
    // learns one arrived (and it's told they'll be attached to the ticket).
    attachmentNote?: string,
    // The actual downloaded bytes of those file(s), attached to whatever ticket
    // the bot opens this turn via open_ticket (consumed on first use).
    pendingAttachments?: PendingAttachment[],
  ): Promise<string | null> {
    try {
      const openai = getOpenAI();
      let pending = pendingAttachments ?? [];
      const systemPrompt = buildAdminSystemPrompt(botConfig, kb, clientRecord);
      const userContent = attachmentNote
        ? `Conversation so far:\n${transcript}\n\n[System note — not a customer message: ${attachmentNote}]\n\nRespond to the customer's latest message.`
        : `Conversation so far:\n${transcript}\n\nRespond to the customer's latest message.`;
      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];

      let raw: string | undefined;
      for (let iteration = 0; iteration < TOOL_CALL_MAX_ITERATIONS; iteration += 1) {
        const response = await openai.chat.completions.create({
          model: CHAT_MODEL,
          temperature: 0.4,
          max_tokens: 700,
          messages: chatMessages,
          tools: [getMyQuotesTool, getMyEnquiriesTool, getMyTicketsTool, getMyFilesTool, getMyFileLinkTool, openTicketTool],
        });
        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) break;

        const toolCalls = assistantMessage.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
          raw = assistantMessage.content?.trim();
          break;
        }

        chatMessages.push({
          role: "assistant",
          content: assistantMessage.content ?? null,
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          const toolResult =
            toolCall.type === "function" && toolCall.function.name === GET_MY_QUOTES_TOOL_NAME
              ? await executeGetMyQuotesTool(orgId, clientId)
              : toolCall.type === "function" && toolCall.function.name === GET_MY_ENQUIRIES_TOOL_NAME
                ? await executeGetMyEnquiriesTool(orgId, clientId)
                : toolCall.type === "function" && toolCall.function.name === GET_MY_TICKETS_TOOL_NAME
                  ? await executeGetMyTicketsTool(orgId, clientId)
                  : toolCall.type === "function" && toolCall.function.name === GET_MY_FILES_TOOL_NAME
                    ? await executeGetMyFilesTool(clientId)
                    : toolCall.type === "function" && toolCall.function.name === GET_MY_FILE_LINK_TOOL_NAME
                      ? await executeGetMyFileLinkTool(clientId, toolCall.function.arguments)
                      : toolCall.type === "function" && toolCall.function.name === OPEN_TICKET_TOOL_NAME
                        ? await executeOpenTicketTool(orgId, clientId, toolCall.function.arguments, pending)
                        : { error: "Unknown tool" };
          // Attachments belong to the FIRST ticket opened this turn — don't
          // re-attach them if the model opens another ticket.
          if (toolCall.type === "function" && toolCall.function.name === OPEN_TICKET_TOOL_NAME) pending = [];
          chatMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
      }

      if (!raw) {
        const finalResponse = await openai.chat.completions.create({
          model: CHAT_MODEL,
          temperature: 0.4,
          max_tokens: 700,
          messages: chatMessages,
          tool_choice: "none",
        });
        raw = finalResponse.choices[0]?.message?.content?.trim();
      }

      return raw || null;
    } catch (err) {
      console.error("[admin-agent] answer failed:", err);
      return null;
    }
  },
};
