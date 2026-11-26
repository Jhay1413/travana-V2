import type { AutoMessagePurpose } from "@shared/schema";

/** How automatic customer messages go out, agency-wide. Absent in the settings = WhatsApp. */
export type AutoChannel = "whatsapp" | "sms";
export const DEFAULT_AUTO_CHANNEL: AutoChannel = "whatsapp";
export const AUTO_CHANNELS = ["whatsapp", "sms"] as const satisfies readonly AutoChannel[];

/** The four automatic types with their own per-type WhatsApp template. */
export const AUTO_PURPOSES = ["booking_confirmation", "portal_ready", "balance_reminder", "departure_reminder"] as const satisfies readonly AutoMessagePurpose[];

/** Every purpose that appears in the log: the four above, the sign-in link, and the quote link a staff member sends. */
export type MessagePurpose = AutoMessagePurpose | "portal_sign_in" | "quote_link";

export type SkipReason =
  | "org_suspended"
  | "no_phone"
  | "opted_out"
  | "not_connected"
  | "no_channel"
  | "no_template"
  | "duplicate"
  | "homeworker"
  | "no_credit"
  | "log_unavailable"
  | "send_failed"
  // Not in the owner's list; needed so every outcome has a name.
  | "switched_off"
  | "fully_paid"
  | "client_not_found"
  | "not_configured"
  // Forgotten-PIN link: the per-email or per-agency daily cap was reached.
  | "capped"
  // The agency's channel setting could not be read: nothing is sent (never a guess).
  | "settings_unavailable"
  // The message promises a quote link and the customer has no quote they can still open.
  | "no_quote_link"
  // A staff-sent WhatsApp: the customer is not linked to a WhatsApp chat and there is no template to start one.
  | "no_contact"
  // A staff-sent WhatsApp the system could not deliver: the agent was handed a wa.me button (we cannot know whether they pressed send).
  | "staff_fallback"
  // The site address is not configured, so a link cannot be built.
  | "no_public_url";

/** What the departure sweep / event handlers know about the message being sent. */
export interface DispatchContext {
  /** The booking that fired the send (the departure sweep); fills the booking fields and lets paid bookings skip balance reminders. */
  bookingId?: string;
  /** Departure sweep only: fire just the SMS rows configured for this many days before. */
  triggerDaysBefore?: number;
  /** Already-sent messages since this moment make the new one a duplicate. */
  dedupeSince?: Date;
}

export interface DispatchInput {
  orgId: string;
  clientId: string;
  purpose: AutoMessagePurpose;
  context: DispatchContext;
  /** Explicit channel; absent = the agency setting. */
  channel?: AutoChannel;
  triggerSource: string;
  actorId?: string | null;
}

/** Message counts for callers that report them (the departure sweep). */
export interface DispatchCounts {
  sent: number;
  skipped: number;
  failed: number;
}

export type DispatchResult =
  | { status: "sent"; channel: ResultChannel; counts: DispatchCounts }
  | { status: "skipped"; channel: ResultChannel; reason: SkipReason; counts: DispatchCounts };

/** "unknown" only when the agency's channel setting could not be read, so nothing was tried. */
export type ResultChannel = AutoChannel | "unknown";

export type ReadinessReason =
  | "switched_off"
  | "not_connected"
  | "no_channel"
  | "no_template"
  | "sms_not_configured"
  | "unreachable"
  | "org_suspended"
  | "database_update_needed"
  | "template_missing"
  | "template_not_approved"
  | "mapping_mismatch";

export interface PurposeReadiness {
  purpose: MessagePurpose;
  /** The SMS template row's active flag; the sign-in link has no switch and is always on. */
  switchedOn: boolean;
  /** Whether a text template row exists for this type at all (the switch has something to turn on). */
  hasSwitch: boolean;
  channel: AutoChannel;
  ready: boolean;
  reason: ReadinessReason | null;
  /** Sign-in link only: it still goes by WhatsApp text without a template, but not outside the 24-hour window. */
  note?: "no_template_outside_window";
}

export interface CustomerMessagingSettings {
  autoChannel: AutoChannel;
}
