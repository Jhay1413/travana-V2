export interface FlightArrival {
  date?: string;
  time?: string;
}

export interface CheckIn {
  date: string;
  time: string;
}

const STANDARD_CHECK_IN = "15:00";
const STANDARD_CHECK_IN_MINUTES = 15 * 60;
const DAY_MINUTES = 24 * 60;

const pad = (n: number) => String(n).padStart(2, "0");

function parseTime(time: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((time ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function addDaysIso(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Hotel check-in for a social post quote: 15:00, or one hour after the
 * outbound flight lands when it lands after 15:00. The date is the arrival
 * date (so overnight flights work) and moves on if the +1h passes midnight.
 */
export function deriveCheckIn(arrival: FlightArrival | undefined, fallbackDate?: string): CheckIn {
  const date = arrival?.date || fallbackDate || "";
  const minutes = parseTime(arrival?.time);
  if (minutes === null || minutes <= STANDARD_CHECK_IN_MINUTES) {
    return { date, time: STANDARD_CHECK_IN };
  }
  const total = minutes + 60;
  const rolled = total >= DAY_MINUTES;
  const wrapped = total % DAY_MINUTES;
  return {
    date: rolled && date ? addDaysIso(date, 1) : date,
    time: `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`,
  };
}

interface OutboundArrivalValues {
  outboundArriveDate?: string;
  outboundArriveTime?: string;
  outboundConnectingLegs?: Array<{ arriveDate?: string; arriveTime?: string }>;
}

/**
 * Where the outbound journey ends: the last connecting leg when there is one
 * with an arrival, otherwise the main outbound leg. Returns null when the form
 * carries no arrival date or time at all (nothing to derive check-in from).
 */
export function outboundArrivalOf(values: OutboundArrivalValues): FlightArrival | null {
  const legs = values.outboundConnectingLegs ?? [];
  const lastLeg = legs[legs.length - 1];
  const arrival: FlightArrival =
    lastLeg?.arriveDate || lastLeg?.arriveTime
      ? { date: lastLeg.arriveDate, time: lastLeg.arriveTime }
      : { date: values.outboundArriveDate, time: values.outboundArriveTime };
  return arrival.date || arrival.time ? arrival : null;
}
