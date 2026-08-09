// Europe/London (UK) time helpers.
//
// The business runs on UK time: a customer saying "call me at 10pm" means 10pm
// in London, whether that's GMT (winter) or BST (summer, UTC+1). Getting that
// wrong silently shifts every callback task by an hour for ~7 months of the
// year, so the conversion is done HERE, deterministically, rather than being
// left to an LLM (which routinely gets the BST offset wrong) or to
// `new Date(...)` (which uses the SERVER's timezone — often UTC in
// production, so UK-local strings would be parsed an hour off in summer).
//
// Intl is used rather than a tz library so this needs no new dependency: the
// runtime's own IANA database is the source of truth for DST boundaries.

const UK_TIME_ZONE = "Europe/London";

const ukParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export interface UkWallClock {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
}

// The UK wall-clock reading of an instant (what a clock in London shows).
export function toUkWallClock(instant: Date): UkWallClock {
  const parts = ukParts.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // en-GB with hour12:false renders midnight as "24" in some runtimes — 24:00
  // of day D is 00:00 of the same date, so normalize it rather than producing
  // an out-of-range hour.
  const hour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: hour === 24 ? 0 : hour,
    minute: get("minute"),
    second: get("second"),
  };
}

// How far ahead of UTC the UK is at a given instant, in ms (0 in GMT,
// 3_600_000 in BST).
function ukOffsetMs(instant: Date): number {
  const w = toUkWallClock(instant);
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Second-resolution formatting: round the instant to whole seconds so the
  // difference is exactly the offset rather than offset-minus-milliseconds.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// A UK wall-clock date/time → the exact instant (UTC Date) it refers to.
//
// Two-pass because the correct offset depends on the instant we're solving
// for: guess with the offset at the naive instant, then re-check with the
// offset at the guess and correct if the guess landed on the other side of a
// DST boundary. The two DST edge cases resolve deterministically (verified by
// the tests): a time in the "lost" hour (01:00-01:59 on the spring-forward
// day, which never happens) settles on the equivalent post-jump instant
// (01:30 → 02:30 BST), and a time in the repeated autumn hour resolves to the
// second, GMT occurrence. Both are an hour out at worst, once a year, for a
// callback nobody books at 1am — not worth a tz library to refine.
export function ukLocalToUtc(w: UkWallClock): Date {
  const naive = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const firstPass = naive - ukOffsetMs(new Date(naive));
  const secondOffset = ukOffsetMs(new Date(firstPass));
  return new Date(naive - secondOffset);
}

// Parses "YYYY-MM-DD HH:mm" / "YYYY-MM-DDTHH:mm[:ss]" as UK LOCAL wall-clock
// and returns the instant it denotes. Any trailing timezone marker is
// rejected: this input is defined to be UK-local, and silently honouring a
// "Z" would reintroduce the offset bug it exists to prevent. Returns null on
// anything unparseable so callers can fall back rather than store a wrong time.
const UK_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
export function parseUkLocalDateTime(text: string): Date | null {
  const m = UK_LOCAL_RE.exec((text ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  // Seconds are optional — absent means :00 (Number(undefined) would be NaN,
  // which `??` does not catch and which poisons the whole date).
  const second = m[6] === undefined ? 0 : Number(m[6]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const instant = ukLocalToUtc({ year, month, day, hour, minute, second: second ?? 0 });
  if (Number.isNaN(instant.getTime())) return null;
  // Round-trip guard: rejects impossible calendar dates (e.g. 2026-02-31),
  // which Date.UTC would silently roll over into the next month.
  const back = toUkWallClock(instant);
  const rolled = back.day !== day || back.month !== month || back.year !== year;
  // The spring-forward gap legitimately shifts the hour, so only the DATE is
  // required to round-trip.
  return rolled ? null : instant;
}

// "2026-08-06 22:00" — the UK wall-clock rendering of an instant, for prompts
// and logs (so both sides of an LLM call talk in the same, unambiguous terms).
export function formatUkLocal(instant: Date): string {
  const w = toUkWallClock(instant);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`;
}

// Long-form UK stamp for prompts, e.g. "Thursday 6 August 2026, 15:42 (BST)".
const ukLongParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});
export function describeUkNow(instant: Date): string {
  return ukLongParts.format(instant).replace(/,\s*$/, "");
}
