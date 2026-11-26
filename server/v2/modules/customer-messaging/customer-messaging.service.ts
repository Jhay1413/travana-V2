import type { AutoMessagePurpose } from "@shared/schema";
import { AppError } from "../../utils/error-handler";
import { organizationRepository } from "../organization/organization.repository";
import { buildSignInText } from "../portal/portal-pin-reset-text";
import { isSmsConfigured, sendAutoSmsTemplates, sendTrackedSms, purposesFor, type AutoSmsResult, type AutoTrigger } from "../sms/sms.service";
import { customerMessagingRepository, LogUnavailableError } from "./customer-messaging.repository";
import { sendAutoWhatsapp, dedupeKeyFor, isSwitchedOn, type BranchOutcome } from "./customer-messaging-whatsapp.service";
import { smsRowMatchesPurpose, triggerForPurpose } from "./customer-messaging.purposes";
import {
  DEFAULT_AUTO_CHANNEL,
  type AutoChannel,
  type CustomerMessagingSettings,
  type DispatchCounts,
  type DispatchInput,
  type DispatchResult,
  type MessagePurpose,
  type ResultChannel,
  type SkipReason,
} from "./customer-messaging.types";

const SETTINGS_SECTION = "messaging";
/** A broken log (e.g. the table is missing) is reported at most this often. */
export const LOG_ERROR_INTERVAL_MS = 60_000;
let lastLogErrorAt = 0;

/** Outcomes nobody needs a row for: nothing was meant to go out. */
const UNLOGGED_REASONS: ReadonlySet<SkipReason> = new Set<SkipReason>(["switched_off", "client_not_found"]);

function parseChannel(value: unknown): AutoChannel {
  return value === "sms" ? "sms" : DEFAULT_AUTO_CHANNEL;
}

/** The channel setting could not be read (a database error). Nothing is sent: a guess could use the wrong channel. */
export class SettingsUnavailableError extends Error {
  constructor() {
    super("customer messaging settings are unavailable");
    this.name = "SettingsUnavailableError";
  }
}

/**
 * The agency's channel for automatic customer messages. A setting that was never stored means WhatsApp; a setting
 * that cannot be READ throws SettingsUnavailableError (callers send nothing), it is never turned into a default.
 */
async function getAutoChannel(orgId: string): Promise<AutoChannel> {
  let org;
  try {
    org = await organizationRepository.findById(orgId);
  } catch (err) {
    console.error("[customer-messaging] could not read the channel setting; sending nothing:", err);
    throw new SettingsUnavailableError();
  }
  const section = (org?.settings as Record<string, unknown> | null | undefined)?.[SETTINGS_SECTION];
  const stored = typeof section === "object" && section !== null ? (section as Record<string, unknown>).autoChannel : undefined;
  return parseChannel(stored);
}

async function setAutoChannel(orgId: string, autoChannel: AutoChannel): Promise<CustomerMessagingSettings> {
  await organizationRepository.mergeSettingsSection(orgId, SETTINGS_SECTION, { autoChannel });
  return { autoChannel };
}

interface LogInput {
  orgId: string;
  clientId: string;
  purpose: MessagePurpose;
  channel: ResultChannel;
  triggerSource: string;
  actorId?: string | null;
  dedupeKey?: string;
  templateName?: string | null;
  providerMessageId?: string | null;
  outcome: { status: "sent" } | { status: "skipped"; reason: SkipReason };
}

/** Writes one outcome row. Never throws: a log failure must not touch the booking or PIN flow. */
async function recordOutcome(input: LogInput): Promise<void> {
  if (input.outcome.status === "skipped" && UNLOGGED_REASONS.has(input.outcome.reason)) return;
  try {
    await customerMessagingRepository.insertLog({
      orgId: input.orgId,
      clientId: input.clientId,
      purpose: input.purpose,
      channel: input.channel,
      status: input.outcome.status,
      reason: input.outcome.status === "skipped" ? input.outcome.reason : null,
      templateName: input.templateName ?? null,
      triggerSource: input.triggerSource.slice(0, 80),
      triggeredBy: input.actorId ?? null,
      providerMessageId: input.providerMessageId ?? null,
      dedupeKey: input.dedupeKey ?? input.purpose,
    });
  } catch (err) {
    const now = Date.now();
    if (now - lastLogErrorAt >= LOG_ERROR_INTERVAL_MS) {
      lastLogErrorAt = now;
      console.warn("[customer-messaging] could not write customer_message_log (is the table in the database?):", err);
    }
  }
}

function smsCounts(r: AutoSmsResult): DispatchCounts {
  return { sent: r.sent, skipped: r.skipped, failed: r.failed };
}

interface BranchDone {
  result: DispatchResult;
  templateName?: string;
  providerMessageId?: string;
  /** The pending log row this send reserved; settled once the outcome is known. */
  reservationId?: string;
}

const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

async function smsBranch(input: DispatchInput): Promise<BranchDone> {
  const { orgId, clientId, purpose, context } = input;
  const none = { sent: 0, skipped: 0, failed: 0 };
  // Switched off: nothing to do, nothing logged.
  if (!(await isSwitchedOn(input))) return { result: { status: "skipped", channel: "sms", reason: "switched_off", counts: none } };
  // A client of another agency is never reached, whatever the caller passed.
  const client = await customerMessagingRepository.findClient(clientId);
  if (!client || client.orgId !== orgId) {
    return { result: { status: "skipped", channel: "sms", reason: "client_not_found", counts: none } };
  }

  // Reserve in the log first: a recent sent or pending row for this message on EITHER channel is a duplicate (so
  // changing the agency's channel inside the window cannot send it twice). Without the log table SMS carries on with
  // its own sms_messages check, exactly as before.
  let reservationId: string | undefined;
  try {
    const reserved = await customerMessagingRepository.reserveSend({
      since: context.dedupeSince ?? new Date(Date.now() - DEFAULT_DEDUPE_WINDOW_MS),
      row: {
        orgId,
        clientId,
        purpose,
        channel: "sms",
        status: "pending",
        triggerSource: input.triggerSource.slice(0, 80),
        triggeredBy: input.actorId ?? null,
        dedupeKey: dedupeKeyFor(input),
      },
    });
    if (!reserved) return { result: { status: "skipped", channel: "sms", reason: "duplicate", counts: { sent: 0, skipped: 1, failed: 0 } } };
    reservationId = reserved.id;
  } catch (err) {
    if (!(err instanceof LogUnavailableError)) throw err;
  }

  // Per booking, the log is the guard for a booking confirmation (two bookings within the window both get theirs);
  // the template-level sms_messages check cannot tell bookings apart, so it only applies where the log is missing.
  const perBooking = reservationId !== undefined && purpose === "booking_confirmation" && context.bookingId !== undefined;
  const r = await sendAutoSmsTemplates({
    clientId,
    autoTrigger: triggerForPurpose(purpose) as AutoTrigger,
    triggerSource: input.triggerSource,
    dedupeSince: perBooking ? undefined : context.dedupeSince,
    triggerDaysBefore: context.triggerDaysBefore,
    bookingId: context.bookingId,
    purpose,
  });
  const base = {
    ...(r.templateName ? { templateName: r.templateName } : {}),
    ...(r.providerMessageId ? { providerMessageId: r.providerMessageId } : {}),
    ...(reservationId ? { reservationId } : {}),
  };
  if (r.sent > 0) return { result: { status: "sent", channel: "sms", counts: smsCounts(r) }, ...base };
  const reason: SkipReason = r.reason ?? (r.failed > 0 ? "send_failed" : "switched_off");
  return { result: { status: "skipped", channel: "sms", reason, counts: smsCounts(r) }, ...base };
}

function fromBranch(outcome: BranchOutcome): BranchDone {
  const reservation = outcome.reservationId ? { reservationId: outcome.reservationId } : {};
  if (outcome.status === "sent") {
    return {
      result: { status: "sent", channel: "whatsapp", counts: { sent: 1, skipped: 0, failed: 0 } },
      templateName: outcome.templateName,
      ...(outcome.providerMessageId ? { providerMessageId: outcome.providerMessageId } : {}),
      ...reservation,
    };
  }
  const failed = outcome.reason === "send_failed";
  return {
    result: { status: "skipped", channel: "whatsapp", reason: outcome.reason, counts: { sent: 0, skipped: failed ? 0 : 1, failed: failed ? 1 : 0 } },
    ...(outcome.templateName ? { templateName: outcome.templateName } : {}),
    ...reservation,
  };
}

/**
 * Sends one automatic customer message by the agency's channel (or the explicit one). Never falls back to the
 * other channel, never throws, and logs every outcome (sent or skipped) to customer_message_log. If the channel
 * setting cannot be read nothing is sent and the skip is logged as settings_unavailable.
 */
async function dispatchCustomerMessage(input: DispatchInput): Promise<DispatchResult> {
  let channel: ResultChannel;
  try {
    channel = input.channel ?? (await getAutoChannel(input.orgId));
  } catch (err) {
    if (!(err instanceof SettingsUnavailableError)) throw err;
    const result: DispatchResult = { status: "skipped", channel: "unknown", reason: "settings_unavailable", counts: { sent: 0, skipped: 0, failed: 1 } };
    await recordOutcome({ orgId: input.orgId, clientId: input.clientId, purpose: input.purpose, channel: "unknown", triggerSource: input.triggerSource, actorId: input.actorId, dedupeKey: dedupeKeyFor(input), outcome: { status: "skipped", reason: "settings_unavailable" } });
    return result;
  }
  let done: BranchDone;
  try {
    done = channel === "sms" ? await smsBranch(input) : fromBranch(await sendAutoWhatsapp(input));
  } catch (err) {
    console.error(`[customer-messaging] ${channel} send for ${input.purpose} failed:`, err);
    done = { result: { status: "skipped", channel, reason: "send_failed", counts: { sent: 0, skipped: 0, failed: 1 } } };
  }
  const { result } = done;
  const outcome = result.status === "sent" ? ({ status: "sent" } as const) : ({ status: "skipped", reason: result.reason } as const);
  if (done.reservationId) {
    await settleReservation(done.reservationId, outcome, done.templateName, done.providerMessageId);
  } else {
    await recordOutcome({
      orgId: input.orgId,
      clientId: input.clientId,
      purpose: input.purpose,
      channel,
      triggerSource: input.triggerSource,
      actorId: input.actorId,
      dedupeKey: dedupeKeyFor(input),
      templateName: done.templateName,
      providerMessageId: done.providerMessageId,
      outcome,
    });
  }
  return result;
}

/** Settles a reserved (pending) row as sent or skipped. Never throws. */
async function settleReservation(
  id: string,
  outcome: { status: "sent" } | { status: "skipped"; reason: SkipReason },
  templateName?: string,
  providerMessageId?: string,
): Promise<void> {
  try {
    await customerMessagingRepository.finalizeLog(id, {
      status: outcome.status,
      reason: outcome.status === "skipped" ? outcome.reason : null,
      templateName: templateName ?? null,
      providerMessageId: providerMessageId ?? null,
    });
  } catch (err) {
    const now = Date.now();
    if (now - lastLogErrorAt >= LOG_ERROR_INTERVAL_MS) {
      lastLogErrorAt = now;
      console.warn("[customer-messaging] could not settle a customer_message_log row:", err);
    }
  }
}

/**
 * Booking created, portal PIN set and the departure sweep land here (through fireAutoTriggerForClient): each
 * message type of the trigger is dispatched by the agency's channel. Returns the legacy counts the sweep reports.
 */
async function fireAutoTrigger(opts: {
  clientId: string;
  autoTrigger: AutoTrigger;
  triggerSource?: string;
  dedupeSince?: Date;
  triggerDaysBefore?: number;
  bookingId?: string;
}): Promise<{ sent: number; skipped: number; failed: number; suspended?: true }> {
  const total = { sent: 0, skipped: 0, failed: 0 };
  try {
    const client = await customerMessagingRepository.findClient(opts.clientId);
    // Messages are per agency: a client without one cannot have automatic messages.
    if (!client?.orgId) return total;
    const purposes: AutoMessagePurpose[] = purposesFor(opts.autoTrigger);
    for (const purpose of purposes) {
      const result = await dispatchCustomerMessage({
        orgId: client.orgId,
        clientId: client.id,
        purpose,
        triggerSource: opts.triggerSource ?? opts.autoTrigger,
        context: { bookingId: opts.bookingId, triggerDaysBefore: opts.triggerDaysBefore, dedupeSince: opts.dedupeSince },
      });
      total.sent += result.counts.sent;
      total.skipped += result.counts.skipped;
      total.failed += result.counts.failed;
      if (result.status === "skipped" && result.reason === "org_suspended") return { ...total, suspended: true };
    }
  } catch (err) {
    console.error("[customer-messaging] fireAutoTrigger failed:", err);
  }
  return total;
}

// ── "Forgotten your PIN?" on the SMS setting ──

export type SignInSmsOutcome = { status: "sent" } | { status: "skipped"; reason: "not_configured" | "capped" | "send_failed" };

/**
 * The sign-in link by SMS (the agency is set to SMS). Goes even when the customer has opted out of
 * automatic messages: they asked for it. The caller has done the lookups, the phone check and the in-memory
 * cap peek; `reserve` is the atomic cap check plus link mint, called only once a send is certain to be tried.
 * Spends SMS credit like any other SMS, and logs to sms_messages and customer_message_log.
 */
async function sendSignInLinkBySms(input: {
  orgId: string;
  clientId: string;
  firstName: string | null;
  lastName?: string | null;
  orgName: string | null;
  phone: string;
  reserve: () => Promise<string | null>;
}): Promise<SignInSmsOutcome> {
  if (!isSmsConfigured()) return { status: "skipped", reason: "not_configured" };
  const link = await input.reserve();
  if (!link) return { status: "skipped", reason: "capped" };
  const outcome = await sendTrackedSms({
    orgId: input.orgId,
    templateId: null,
    templateName: "Portal sign-in link",
    clientId: input.clientId,
    clientName: `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim(),
    phone: input.phone,
    body: buildSignInText({ firstName: input.firstName, orgName: input.orgName, link }),
    triggerSource: "portal.pin-reset",
  });
  if (!outcome.ok) {
    console.warn(`[portal-pin-reset] SMS rejected: ${outcome.error}`);
    return { status: "skipped", reason: "send_failed" };
  }
  return { status: "sent" };
}

/**
 * Turns a message type on or off: the active flag of the agency's SMS template rows for that type (the one switch
 * for both channels). A type with no text template yet cannot be switched on here: the agency creates one first.
 */
async function setSwitch(orgId: string, purpose: AutoMessagePurpose, active: boolean): Promise<{ purpose: AutoMessagePurpose; active: boolean; rows: number }> {
  const rows = (await customerMessagingRepository.listSwitchRows(orgId)).filter((r) => smsRowMatchesPurpose(r, purpose));
  if (rows.length === 0) {
    throw new AppError("There is no text message for this type yet. Add one in SMS templates first, then switch it on here.", 409);
  }
  const changed = await customerMessagingRepository.setSwitchActive(orgId, rows.map((r) => r.id), active);
  return { purpose, active, rows: changed };
}

export const customerMessagingService = {
  setSwitch,
  getAutoChannel,
  getSettings: async (orgId: string): Promise<CustomerMessagingSettings> => ({ autoChannel: await getAutoChannel(orgId) }),
  setAutoChannel,
  dispatchCustomerMessage,
  fireAutoTrigger,
  sendSignInLinkBySms,
  recordOutcome,
};

export { dispatchCustomerMessage };
