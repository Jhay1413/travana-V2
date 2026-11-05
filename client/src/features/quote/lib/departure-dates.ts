import { addDays, format, isValid, parseISO } from "date-fns";

export interface DepartureDatesInput {
  checkInDate: string | null | undefined;
  nights: number | string | null | undefined;
  /** The outbound departure date already on the form. */
  currentOutboundDepart: string | null | undefined;
  /** True when the check-in was derived from the outbound arrival (it may be the day after landing). */
  checkInIsDerived: boolean;
  socialPost?: boolean;
}

export interface DepartureDatesUpdate {
  outboundDepartDate?: string;
  inboundDepartDate?: string;
}

/**
 * Flight dates implied by the check-in date: outbound departs on check-in
 * (unless the check-in was derived from the flights and a departure is already
 * set), inbound departs check-in + nights. Pure; the forms apply the result
 * only after the first render so opening a saved deal never rewrites its dates.
 */
export function departureDatesForCheckIn(input: DepartureDatesInput): DepartureDatesUpdate {
  if (!input.checkInDate) return {};
  const date = parseISO(input.checkInDate);
  if (!isValid(date)) return {};
  const out: DepartureDatesUpdate = {};
  if ((!input.socialPost && !input.checkInIsDerived) || !input.currentOutboundDepart) {
    out.outboundDepartDate = input.checkInDate;
  }
  const nightCount = Number(input.nights) || 0;
  if (nightCount > 0) out.inboundDepartDate = format(addDays(date, nightCount), "yyyy-MM-dd");
  return out;
}
