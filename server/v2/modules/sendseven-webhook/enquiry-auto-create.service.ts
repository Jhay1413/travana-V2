import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { airportRepository } from "../airport/airport.repository";
import { lookupService } from "../../lookup/lookup.service";
import { normalizeEnquiry } from "../../utils/enum-normalizers";
import { transactionService } from "../transaction/transaction.service";
import { systemScope } from "./identity.service";
import type { EnquirySlots } from "./enquiry.types";

// Coerce to string first — the AI sometimes returns numbers where we expect text
// (e.g. budget as 400, star rating as 5), which would otherwise crash string ops.
const str = (v: unknown): string => String(v ?? "").trim();
const norm = (s: unknown): string => str(s).toLowerCase();

// Airport-name comparison form: lowercase, generic suffix words removed
// ("International", "Intl", "Int", "Airport", "Apt" — with or without a
// trailing dot), punctuation collapsed. "Newcastle Int." and "Newcastle
// International Airport" both normalize to "newcastle".
export const normAirport = (s: unknown): string =>
  norm(s)
    .replace(/\b(?:international|intl|int|airport|apt)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Coerce to an integer, accepting numbers OR numeric strings ("4", "4 nights").
// The AI sometimes returns numeric fields as strings — without this they'd be lost.
function toInt(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isNaN(v) ? undefined : Math.trunc(v);
  if (typeof v === "string") {
    const m = v.match(/-?\d+/);
    if (m) {
      const n = parseInt(m[0], 10);
      return Number.isNaN(n) ? undefined : n;
    }
  }
  return undefined;
}

// Canonical board-basis + star-rating values (mirrors the enquiry wizard). Anything
// the AI produces outside these is dropped to notes rather than stored — stops
// hallucinated values (e.g. "American Plan", "Luxury") landing in the enquiry.
const ALLOWED_BOARD_BASIS = ["all inclusive", "bed and breakfast", "self catering", "half board", "full board", "room only"];
const ALLOWED_STAR_RATINGS = ["2 star", "3 star", "4 star", "5 star"];

// Case-insensitively de-duplicates a string array, preserving the first
// spelling. A bare string is treated as a one-element array — the model
// returns some fields (e.g. boardBasis: "All Inclusive") as strings, and
// those used to be silently dropped here (never mapped, never noted).
function dedupe(arr: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const list = Array.isArray(arr) ? arr : typeof arr === "string" && arr.trim() ? [arr] : [];
  for (const s of list) {
    const v = str(s);
    const k = v.toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

// travel_date is a Postgres `date` column, so only a real YYYY-MM-DD is valid.
// Anything else (a range, "mid August", "not sure") must NOT be sent to the DB —
// the caller records the wording in notes instead.
function validIsoDate(s: unknown): string | undefined {
  const v = str(s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : v;
}

// budget is a numeric column — strip "£", commas and any words ("per person") and
// keep the first number. e.g. "£1,100 per person" -> "1100".
function parseBudget(raw: unknown): string | undefined {
  const m = str(raw).replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? m[0] : undefined;
}

// budget_type must be "Per Person" or "Package". Prefer the explicit slot, else
// infer from the budget wording (e.g. "£1100 per person").
function budgetType(explicit: unknown, raw: unknown): string | undefined {
  const text = `${str(explicit)} ${str(raw)}`.toLowerCase();
  if (/per\s*person|\bpp\b|each|per head/.test(text)) return "Per Person";
  if (/package|total|all[- ]?in|altogether|between us|as a group/.test(text)) return "Package";
  return undefined;
}

// AI-created enquiries need a real user_id (transaction.user_id is NOT NULL) —
// use an active org_admin, else any active member. DB access lives in the
// branch-member repository; this just delegates.
async function orgUserId(orgId: string): Promise<string | null> {
  return branchMemberRepository.findDefaultOwner(orgId);
}

export interface EnquiryCreateExtras {
  // A short human-readable summary of the conversation/enquiry, written onto
  // the enquiry's first note alongside anything still outstanding.
  summary?: string;
  // Labels of fields the detected holiday type still needs (holiday-type field
  // list minus filled slots) — written onto the same note.
  missingFields?: string[];
  // Tags the created transaction as a test record (transaction.is_test) — set
  // by the internal test-flow driver so its synthetic runs never pollute real
  // reporting. Defaults to false, matching all existing (SendSeven) callers.
  isTest?: boolean;
}

export interface EnquiryCreateResult {
  enquiryId: string | null;
  // The org user the enquiry (and any follow-up task) is owned by.
  ownerUserId: string | null;
}

// Resolves the collected free-text slots to lookup IDs (holiday type, destinations,
// board basis) and creates the enquiry. Resorts / airports / accommodation type /
// cruise line / unmatched values go into notes (§14).
export async function resolveAndCreateEnquiry(
  orgId: string,
  clientId: string | null,
  slots: EnquirySlots,
  extras?: EnquiryCreateExtras,
): Promise<EnquiryCreateResult> {
  const userId = await orgUserId(orgId);
  if (!userId) {
    console.warn(`[sendseven-webhook] org ${orgId} has no user to own the enquiry — skipping create.`);
    return { enquiryId: null, ownerUserId: null };
  }

  const [packageTypes, countries, destinations, boardBasis, airports] = await Promise.all([
    lookupService.getPackageTypes() as Promise<Array<{ id: string; name: string }>>,
    lookupService.getCountries() as Promise<Array<{ country_name: string }>>,
    lookupService.getDestinations({ limit: 100000 }) as Promise<Array<{ id: string; name: string; country_id?: string }>>,
    lookupService.getBoardBasis() as Promise<Array<{ id: string; type: string }>>,
    airportRepository.findAll() as Promise<Array<{ id: string; airport_name: string; airport_code: string | null }>>,
  ]);

  const unmapped: string[] = [];

  // Holiday type → id (default Package Holiday).
  let holidayTypeId: string | undefined;
  if (slots.holidayType) {
    const q = norm(slots.holidayType);
    const pt = packageTypes.find((p) => norm(p.name) === q) || packageTypes.find((p) => norm(p.name).includes(q));
    if (pt) holidayTypeId = pt.id;
  }
  if (!holidayTypeId) holidayTypeId = packageTypes.find((p) => norm(p.name) === "package holiday")?.id;

  const destinationSet = new Set<string>();
  for (const name of dedupe(slots.destinations)) {
    const q = norm(name);
    const d =
      destinations.find((x) => norm(x.name) === q) ||
      destinations.find((x) => norm(x.name).includes(q) || q.includes(norm(x.name)));
    if (d) destinationSet.add(d.id);
    else unmapped.push(`Destination: ${name.trim()}`);
  }

  // Resorts → resort IDs, and each resort's destination is added so the enquiry's
  // Destination field is populated too (e.g. "Albufeira" → its destination).
  const resortSet = new Set<string>();
  for (const name of dedupe(slots.resorts)) {
    const q = norm(name);
    const rows = (await lookupService.getResorts({ search: name, limit: 10 })) as Array<{
      id: string;
      name: string;
      destination_id?: string;
    }>;
    const r = rows.find((x) => norm(x.name) === q) || rows.find((x) => norm(x.name).includes(q)) || rows[0];
    if (r) {
      resortSet.add(r.id);
      if (r.destination_id) destinationSet.add(r.destination_id);
    } else unmapped.push(`Resort: ${name.trim()}`);
  }
  const destinationIds = [...destinationSet];
  const resortIds = [...resortSet];

  // Departure airports → IDs, matched by code ("NCL") or name ("Newcastle").
  // Name comparisons use normAirport (punctuation stripped, generic suffixes
  // like "International"/"Int."/"Airport" removed) so ad-copy spellings the AI
  // extracts verbatim — "Newcastle Int.", "Manchester Airport" — still match
  // the lookup row instead of being dropped to the note.
  const airportSet = new Set<string>();
  for (const name of dedupe(slots.departureAirports)) {
    const q = norm(name);
    const qa = normAirport(name);
    const a =
      airports.find((x) => norm(x.airport_code) === q) ||
      airports.find((x) => normAirport(x.airport_name) === qa) ||
      (qa ? airports.find((x) => normAirport(x.airport_name).includes(qa) || qa.includes(normAirport(x.airport_name))) : undefined);
    if (a) airportSet.add(a.id);
    else unmapped.push(`Departure airport: ${name.trim()}`);
  }
  const departureAirportIds = [...airportSet];

  // Board basis constrained to the canonical set (matches the enquiry wizard), so
  // the AI can't inject odd rows like "American Plan". Deduped.
  const allowedBoardBasis = boardBasis.filter((b) => ALLOWED_BOARD_BASIS.includes(norm(b.type)));
  const boardBasisSet = new Set<string>();
  for (const name of dedupe(slots.boardBasis)) {
    const q = norm(name);
    const b = allowedBoardBasis.find((x) => norm(x.type) === q) || allowedBoardBasis.find((x) => norm(x.type).includes(q));
    if (b) boardBasisSet.add(b.id);
    else if (name.trim()) unmapped.push(`Board basis: ${name.trim()}`);
  }
  const boardBasisIds = [...boardBasisSet];

  // A country with no matched destination/resort is noted (the enquiry stores
  // destinations, not bare countries).
  if (!destinationIds.length && !resortIds.length) {
    for (const name of dedupe(slots.countries)) unmapped.push(`Country: ${name}`);
  }
  if (str(slots.accommodationType)) unmapped.push(`Accommodation type: ${str(slots.accommodationType)}`);
  if (str(slots.cruiseLine)) unmapped.push(`Cruise line: ${str(slots.cruiseLine)}`);

  // Only a real YYYY-MM-DD goes to the date column; a range/vague timing is kept
  // as-is in the notes so nothing is lost and the insert never fails.
  const travelDate = validIsoDate(slots.travelDate);
  if (str(slots.travelDate) && !travelDate) unmapped.push(`Preferred travel timing: ${str(slots.travelDate)}`);

  // Star rating only if it's a real 2–5 Star value; else keep the wording in notes.
  const starRating = ALLOWED_STAR_RATINGS.includes(norm(slots.starRating)) ? str(slots.starRating) : undefined;
  if (str(slots.starRating) && !starRating) unmapped.push(`Preference: ${str(slots.starRating)}`);

  const noteParts: string[] = [];
  if (extras?.summary?.trim()) noteParts.push(`Summary: ${extras.summary.trim()}`);
  if (str(slots.notes)) noteParts.push(str(slots.notes));
  if (unmapped.length) noteParts.push(`To confirm with the customer: ${unmapped.join("; ")}`);
  if (extras?.missingFields?.length) noteParts.push(`Additional fields still needed: ${extras.missingFields.join("; ")}`);
  // The enquiry note is shown by the client's rich-text (WYSIWYG) note viewer,
  // which renders HTML — agent-typed notes are stored as HTML, and plain-text
  // newlines collapse into one run-on blob there. So assemble this note as
  // simple HTML: one <p> per section, <br> for the lines within a section
  // (e.g. the Post reference bullets), text escaped so a deal title with
  // <, > or & can't inject markup.
  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const notes = noteParts.length
    ? noteParts.map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("")
    : undefined;

  const nights = toInt(slots.nights);

  const enquiryPayload = {
    title: str(slots.enquiryTitle) || "Enquiry from conversation",
    holiday_type_id: holidayTypeId,
    travel_date: travelDate,
    adults: toInt(slots.adults),
    children: toInt(slots.children),
    infants: toInt(slots.infants),
    no_of_nights: nights,
    flexible_nights: nights ? [nights] : undefined,
    budget: parseBudget(slots.budget),
    budget_type: budgetType(slots.budgetType, slots.budget),
    accom_min_star_rating: starRating,
    flexibility_date: str(slots.flexibility) || undefined,
    cabin_type: str(slots.cabinType) || undefined,
    pre_cruise_stay: toInt(slots.preCruiseStay),
    post_cruise_stay: toInt(slots.postCruiseStay),
    no_of_guests: toInt(slots.guests),
    no_of_pets: toInt(slots.pets),
    weekend_lodge: str(slots.weekendLodge) || undefined,
    status: "ACTIVE",
    notes,
    destinations: destinationIds.length ? destinationIds : undefined,
    resorts: resortIds.length ? resortIds : undefined,
    boardBases: boardBasisIds.length ? boardBasisIds : undefined,
    departureAirports: departureAirportIds.length ? departureAirportIds : undefined,
    passengers: (slots.childAges ?? []).map((age) => ({ type: "child", age: toInt(age) ?? 0 })),
  };

  const normalized = normalizeEnquiry(enquiryPayload);
  const result = await transactionService.createTransactionWithEnquiry(
    { client_id: clientId, user_id: userId, is_test: extras?.isTest ?? false },
    normalized as Parameters<typeof transactionService.createTransactionWithEnquiry>[1],
    systemScope(orgId),
    null,
  );

  const created = result as { enquiry?: { id?: string }; id?: string } | undefined;
  const enquiryId = created?.enquiry?.id ?? created?.id ?? null;
  return { enquiryId, ownerUserId: userId };
}
