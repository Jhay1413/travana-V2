import { addDays, format, isValid, parseISO } from "date-fns";

/**
 * Date defaults for a newly added extra (transfer, car hire, attraction ticket,
 * lounge pass, airport parking, extra accommodation). Pure so it can be unit
 * tested; used by the shared quote/booking extras section.
 *
 * Usage / visit / parking / check-in / pick-up dates default to the travel date
 * and drop-off / return dates to the return date. Only EMPTY fields are filled,
 * so anything the user already typed is never overwritten.
 */

export type ExtraKind = "transfer" | "carHire" | "attractionTicket" | "loungePass" | "airportParking" | "extraAccommodation";

export interface ExtrasDateContext {
  travelDate?: string | null;
  /** Primary accommodation check-in; used for extra accommodation when set. */
  checkInDate?: string | null;
  cruiseDate?: string | null;
  /** Explicit return flight date, when the form has one. */
  inboundDepartDate?: string | null;
  nights?: number | string | null;
}

const YMD = "yyyy-MM-dd";

function validDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = parseISO(raw);
  return isValid(d) ? raw : "";
}

/** The date the trip starts (yyyy-MM-dd), or "" when the form has none yet. */
export function resolveTravelDate(ctx: ExtrasDateContext): string {
  return validDate(ctx.travelDate) || validDate(ctx.checkInDate) || validDate(ctx.cruiseDate);
}

/** The explicit return date, else travel date + nights, else "". */
export function resolveReturnDate(ctx: ExtrasDateContext): string {
  const explicit = validDate(ctx.inboundDepartDate);
  if (explicit) return explicit;
  const start = resolveTravelDate(ctx);
  const nights = Number(ctx.nights) || 0;
  if (!start || nights <= 0) return "";
  return format(addDays(parseISO(start), nights), YMD);
}

const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === "";

/** Returns `row` with its empty date fields filled from the quote's dates. */
export function withExtraDateDefaults<T extends Record<string, unknown>>(kind: ExtraKind, row: T, ctx: ExtrasDateContext): T {
  const travel = resolveTravelDate(ctx);
  const back = resolveReturnDate(ctx);
  const fills: Record<string, string> = {};
  switch (kind) {
    case "transfer":
    case "carHire":
      fills.pickUpDate = travel;
      fills.dropOffDate = back;
      break;
    case "attractionTicket":
      fills.dateOfVisit = travel;
      break;
    case "loungePass":
      fills.dateOfUsage = travel;
      break;
    case "airportParking":
      fills.parkingDate = travel;
      break;
    case "extraAccommodation":
      fills.checkInDate = validDate(ctx.checkInDate) || travel;
      break;
  }
  const out: Record<string, unknown> = { ...row };
  for (const [field, value] of Object.entries(fills)) {
    if (value && isEmpty(out[field])) out[field] = value;
  }
  return out as T;
}
