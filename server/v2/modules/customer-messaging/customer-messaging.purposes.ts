import type { AutoMessagePurpose } from "@shared/schema";

// Which automatic message type an SMS template row belongs to. The row's active flag is the on/off
// switch for the message type on BOTH channels, so the same mapping decides what WhatsApp may send.

export type SmsAutoTriggerName = "on_booking_create" | "on_pin_set" | "days_before_departure";

export interface SmsRowShape {
  autoTrigger: string;
  category: string;
  triggerDaysBefore?: number | null;
}

/** The SMS template category that makes a days-before-departure row a balance reminder (all others are departure reminders). */
export const BALANCE_CATEGORY = "balance_due";

export function purposesForTrigger(trigger: SmsAutoTriggerName): AutoMessagePurpose[] {
  switch (trigger) {
    case "on_booking_create":
      return ["booking_confirmation"];
    case "on_pin_set":
      return ["portal_ready"];
    case "days_before_departure":
      return ["balance_reminder", "departure_reminder"];
  }
}

export function triggerForPurpose(purpose: AutoMessagePurpose): SmsAutoTriggerName {
  switch (purpose) {
    case "booking_confirmation":
      return "on_booking_create";
    case "portal_ready":
      return "on_pin_set";
    case "balance_reminder":
    case "departure_reminder":
      return "days_before_departure";
  }
}

/** Does this (already active) SMS row switch the given message type on? */
export function smsRowMatchesPurpose(row: SmsRowShape, purpose: AutoMessagePurpose): boolean {
  if (row.autoTrigger !== triggerForPurpose(purpose)) return false;
  if (purpose === "balance_reminder") return row.category === BALANCE_CATEGORY;
  if (purpose === "departure_reminder") return row.category !== BALANCE_CATEGORY;
  return true;
}
