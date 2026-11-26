import type { Scope } from "../../utils/scope";
import { AppError } from "../../utils/error-handler";
import { neonClientService } from "../neon-client/neon-client.service";
import { reasonText } from "./customer-messaging.reasons";
import { customerMessagingRepository, LogUnavailableError } from "./customer-messaging.repository";
import { DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT } from "./customer-messaging-staff.validator";
import type { MessageLogEntry, MessageLogPage, MessageLogRow } from "./customer-messaging-staff.types";

// The "Messages sent" history of one client. Same access rule as opening the client page (an agency only ever sees
// its own clients; someone else's client reads as not found), and the response carries no body, phone or link.

/** The only fields that leave the server; building the entry key by key keeps anything else from leaking by accident. */
export function toEntry(row: MessageLogRow): MessageLogEntry {
  return {
    id: row.id,
    purpose: row.purpose,
    channel: row.channel,
    status: row.status,
    reason: row.status === "sent" ? null : reasonText(row.reason),
    templateName: row.templateName,
    triggerSource: row.triggerSource,
    triggeredByName: row.triggeredByName,
    createdAt: row.createdAt.toISOString(),
  };
}

async function list(input: { clientId: string; limit?: number; cursor?: string }, scope: Scope): Promise<MessageLogPage> {
  if (!scope.orgId) throw new AppError("No organisation in scope", 400);
  // Throws 404 for a client the caller cannot open (including another agency's).
  await neonClientService.viewNeonClientById(input.clientId, scope);
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LOG_LIMIT, 1), MAX_LOG_LIMIT);
  const offset = input.cursor ? Number.parseInt(input.cursor, 10) || 0 : 0;
  try {
    // One extra row tells whether there is another page.
    const rows = await customerMessagingRepository.listLogForClient({ orgId: scope.orgId, clientId: input.clientId, limit: limit + 1, offset });
    const hasMore = rows.length > limit;
    return {
      items: rows.slice(0, limit).map(toEntry),
      nextCursor: hasMore ? String(offset + limit) : null,
      unavailable: false,
    };
  } catch (err) {
    if (err instanceof LogUnavailableError) return { items: [], nextCursor: null, unavailable: true };
    throw err;
  }
}

export const customerMessagingLogService = { list };
