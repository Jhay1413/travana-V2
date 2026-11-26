import { AppError } from "../../utils/error-handler";
import { runWithSendSevenConfigAsync } from "../../utils/sendseven";
import { channelsService } from "../channels/channels.service";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { buildContextForClient, normalisePhone } from "../sms/sms.service";
import { smsRepository } from "../sms/sms.repository";
import { usageService } from "../usage/usage.service";
import { pickWhatsappChannel, resolveVariableValues, sendTemplate, templateRecipient } from "../whatsapp-templates/whatsapp-delivery.service";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { customerMessagingRepository, LogUnavailableError, type MessagingClient } from "./customer-messaging.repository";
import { smsRowMatchesPurpose } from "./customer-messaging.purposes";
import type { DispatchInput, SkipReason } from "./customer-messaging.types";

// The WhatsApp branch of automatic customer messages. Always the agency's approved template for the message
// type, always to the customer's own phone on file (never a linked contact's other number), and never an SMS.
// Anything that cannot go is skipped with a reason; nothing falls back to another channel.

/** `reservationId` is set once the send was reserved in the log (pending); the dispatcher then settles that row. */
export type BranchOutcome =
  | { status: "sent"; templateName: string; providerMessageId: string | null; reservationId?: string }
  | { status: "skipped"; reason: SkipReason; templateName?: string; reservationId?: string };

const skip = (reason: SkipReason, templateName?: string, reservationId?: string): BranchOutcome => ({
  status: "skipped",
  reason,
  ...(templateName ? { templateName } : {}),
  ...(reservationId ? { reservationId } : {}),
});

/** Event triggers pass their own window; without one, a retried event is still held to the SMS window. */
const AUTO_USAGE_SOURCE = "auto" as const;
const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export function dedupeKeyFor(input: Pick<DispatchInput, "purpose" | "context">): string {
  return input.context.bookingId ? `${input.purpose}:${input.context.bookingId}` : input.purpose;
}

/**
 * "Handled by a homeworker": the client sits in a homeworker branch (branches.branch_type = 'homeworker'), or
 * the user who created the client holds the homeworker role in this agency; and, when the send names a booking,
 * the same two tests on that booking's deal (its branch, and the agent who owns it).
 */
export async function isHandledByHomeworker(client: MessagingClient, orgId: string, bookingId?: string): Promise<boolean> {
  const branchIds = client.branchId ? [client.branchId] : [];
  const userIds = client.createdBy ? [client.createdBy] : [];
  if (bookingId) {
    const owner = await customerMessagingRepository.findBookingOwner(client.id, bookingId);
    if (owner?.branchId) branchIds.push(owner.branchId);
    if (owner?.userId) userIds.push(owner.userId);
  }
  return customerMessagingRepository.hasHomeworkerOwner({ orgId, branchIds, userIds });
}

/**
 * The SMS template row's active flag is the on/off switch for the message type, on both channels. Checked first,
 * so an agency that has the type switched off costs no further queries and leaves no log rows.
 */
export async function isSwitchedOn(input: Pick<DispatchInput, "orgId" | "purpose" | "context">): Promise<boolean> {
  const rows = await customerMessagingRepository.listActiveSwitchRows(input.orgId);
  return rows.some(
    (r) => smsRowMatchesPurpose(r, input.purpose) && (input.context.triggerDaysBefore === undefined || r.triggerDaysBefore === input.context.triggerDaysBefore),
  );
}

export async function sendAutoWhatsapp(input: DispatchInput): Promise<BranchOutcome> {
  const { orgId, clientId, purpose, context } = input;

  if (!(await isSwitchedOn(input))) return skip("switched_off");
  const client = await customerMessagingRepository.findClient(clientId);
  if (!client || client.orgId !== orgId) return skip("client_not_found");
  if (!(await customerMessagingRepository.isOrgActive(orgId))) return skip("org_suspended");
  if (!client.smsOptIn) return skip("opted_out");
  const phone = normalisePhone(client.phoneNumber);
  if (!phone) return skip("no_phone");
  if (await isHandledByHomeworker(client, orgId, context.bookingId)) return skip("homeworker");

  if (purpose === "balance_reminder" && context.bookingId && (await smsRepository.isBookingFullyPaid(context.bookingId))) return skip("fully_paid");

  // The duplicate guard reads the log; with no log table nothing is sent (SMS is unaffected).
  try {
    const since = context.dedupeSince ?? new Date(Date.now() - DEFAULT_DEDUPE_WINDOW_MS);
    if (await customerMessagingRepository.hasRecentSent({ orgId, clientId, purpose, dedupeKey: dedupeKeyFor(input), since })) return skip("duplicate");
  } catch (err) {
    if (err instanceof LogUnavailableError) return skip("log_unavailable");
    throw err;
  }

  const config = (await whatsappSettingsService.getPurposeTemplates(orgId))[purpose];
  const templateName = config?.templateName ?? null;
  if (!config || !templateName) return skip("no_template");

  const integration = await conversationIntegrationService.resolveConfig(orgId);
  // No workspace for this agency: fail closed, never another tenant's token.
  if (!integration) return skip("not_connected", templateName);

  return runWithSendSevenConfigAsync(integration, async (): Promise<BranchOutcome> => {
    let channels;
    try {
      channels = await channelsService.listChannels(true);
    } catch (err) {
      console.warn(`[customer-messaging] could not list channels for org ${orgId}:`, err instanceof AppError ? err.message : err);
      return skip("not_connected", templateName);
    }
    const channel = pickWhatsappChannel(channels, config.channelId);
    if (!channel) return skip("no_channel", templateName);

    let reservationId: string | undefined;
    try {
      const ctx = await buildContextForClient(client, { bookingId: context.bookingId });
      const variableValues = await resolveVariableValues(config.variables, {
        orgId,
        clientFirstName: client.firstName,
        destination: ctx.destination,
        bookingReference: ctx.hays_ref || ctx.supplier_ref,
        departureDate: ctx.departure_date,
        portalLink: ctx.portal_link ?? undefined,
        balanceDueDate: ctx.balance_due_date,
      });
      // Reserve before sending: under a lock, a recent sent or pending row (either channel) is a duplicate; otherwise this
      // send is written as pending first, so a second request cannot pass the check while this one is in flight.
      try {
        const reserved = await customerMessagingRepository.reserveSend({
          since: context.dedupeSince ?? new Date(Date.now() - DEFAULT_DEDUPE_WINDOW_MS),
          row: {
            orgId,
            clientId,
            purpose,
            channel: "whatsapp",
            status: "pending",
            templateName,
            triggerSource: input.triggerSource.slice(0, 80),
            triggeredBy: input.actorId ?? null,
            dedupeKey: dedupeKeyFor(input),
          },
        });
        if (!reserved) return skip("duplicate", templateName);
        reservationId = reserved.id;
      } catch (err) {
        if (err instanceof LogUnavailableError) return skip("log_unavailable", templateName);
        throw err;
      }
      const res = await sendTemplate({
        templateName,
        language: config.language,
        channelId: channel.id,
        // The customer's phone on file only: no contact, no conversation.
        recipient: templateRecipient({ conversationId: null, contactId: null, phone }),
        variableValues,
      });
      if (res.success !== true) {
        console.warn(`[customer-messaging] template "${templateName}" rejected: ${res.error_details ?? res.error ?? "unknown error"}`);
        return skip("send_failed", templateName, reservationId);
      }
      void usageService.recordSendsevenSend({ orgId, source: AUTO_USAGE_SOURCE });
      return { status: "sent", templateName, providerMessageId: res.message_id ?? res.external_id ?? null, ...(reservationId ? { reservationId } : {}) };
    } catch (err) {
      console.warn(`[customer-messaging] WhatsApp send failed for org ${orgId}:`, err instanceof AppError ? err.message : err);
      return skip("send_failed", templateName, reservationId);
    }
  });
}
