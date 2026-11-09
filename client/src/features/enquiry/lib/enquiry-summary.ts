import { holidayKind, type EnquiryForm, type HolidayKind } from "./enquiry-form";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-07-01" -> "1 Jul 2026"; anything else is returned as typed. */
export function formatSummaryDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : iso;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const placeName = (label: string): string => label.split(",")[0].trim();

function partyText(form: EnquiryForm): string {
  const parts = [plural(form.adults, "adult", "adults")];
  if (form.children > 0) parts.push(plural(form.children, "child", "children"));
  if (form.infants > 0) parts.push(plural(form.infants, "infant", "infants"));
  return parts.join(", ");
}

function budgetText(form: EnquiryForm, kind: HolidayKind): string {
  const min = form.budget.trim();
  const max = form.maxBudget.trim();
  let amount = "";
  if (kind === "package") amount = min ? `£${min}` : "";
  else if (min && max) amount = `£${min} to £${max}`;
  else if (min || max) amount = `£${min || max}`;
  if (!amount) return "";
  return `${amount} ${form.budgetType === "Package" ? "package" : "per person"}`;
}

/**
 * One-line live summary for the footer, e.g.
 * "Lanzarote, Tenerife · 1 Jul 2026 · 7 nights · 2 adults, 1 child · from Manchester · £3000 per person".
 * `labels` maps lookup ids to display names; unknown ids are skipped.
 */
export function summariseEnquiry(form: EnquiryForm, labels: Record<string, string> = form.labels): string {
  const kind = holidayKind(form.holidayTypeName);
  const names = (ids: string[]): string[] => ids.map((id) => labels[id]).filter((l): l is string => !!l).map(placeName);
  const parts: string[] = [];
  // Nights and the party always have a default, so they do not count as "filled in".
  let specific = 0;
  const add = (text: string) => {
    parts.push(text);
    specific += 1;
  };

  const where = names(kind === "cruise" ? form.destinations.slice(0, 1) : form.destinations);
  if (where.length) add(where.slice(0, 3).join(", ") + (where.length > 3 ? ` +${where.length - 3}` : ""));
  if (form.travelDate) add(formatSummaryDate(form.travelDate));
  else if (form.flexibility) add(form.flexibility);

  const nights = form.flexibleNights.map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  if (nights.length) parts.push(`${nights.join(" or ")} ${nights.length === 1 && nights[0] === 1 ? "night" : "nights"}`);

  if (kind === "hottub") {
    parts.push(plural(form.guests, "guest", "guests"));
    if (form.pets > 0) parts.push(plural(form.pets, "pet", "pets"));
  } else {
    parts.push(partyText(form));
    const from = names(form.airports);
    if (from.length) add(`from ${from.slice(0, 2).join(", ")}${from.length > 2 ? ` +${from.length - 2}` : ""}`);
  }
  const budget = budgetText(form, kind);
  if (budget) add(budget);

  return specific > 0 ? parts.join(" · ") : "Nothing filled in yet.";
}
