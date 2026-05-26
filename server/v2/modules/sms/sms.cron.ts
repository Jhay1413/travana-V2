import { smsRepository } from "./sms.repository";
import { fireAutoTriggerForClient } from "./sms.service";

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDaysIsoDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD — matches the booking.travel_date `date` column
}

/**
 * For every active template with autoTrigger='days_before_departure', find
 * bookings whose travel_date is exactly `triggerDaysBefore` away and fire
 * the SMS for each client. Idempotent: a re-run on the same UTC day skips
 * any (template, client) already auto-sent today.
 *
 * Safe to call from a cron job — never throws; logs failures and moves on.
 */
export async function runDaysBeforeDepartureSweep(): Promise<{
  templatesChecked: number;
  bookingsMatched: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const summary = { templatesChecked: 0, bookingsMatched: 0, sent: 0, skipped: 0, failed: 0 };
  try {
    const templates = await smsRepository.findAllActiveTemplatesByTrigger("days_before_departure");
    summary.templatesChecked = templates.length;
    if (templates.length === 0) return summary;

    // Distinct days-before values to scan — most agencies will only have one
    // (e.g. 14 days for balance-due). Keep deduped to avoid double-queries.
    const daysBeforeValues = Array.from(new Set(
      templates
        .map((t) => t.triggerDaysBefore)
        .filter((n): n is number => typeof n === "number" && n >= 0),
    ));

    const dedupeSince = startOfTodayUtc();

    for (const n of daysBeforeValues) {
      const targetDate = addDaysIsoDate(n);
      const bookings = await smsRepository.findActiveBookingsByTravelDate(targetDate);
      summary.bookingsMatched += bookings.length;

      for (const row of bookings) {
        if (!row.clientId) continue;
        const result = await fireAutoTriggerForClient({
          clientId: row.clientId,
          autoTrigger: "days_before_departure",
          triggerSource: `cron.days_before_departure.${n}`,
          dedupeSince,
        });
        summary.sent += result.sent;
        summary.skipped += result.skipped;
        summary.failed += result.failed;
      }
    }
  } catch (err) {
    console.error("[sms.cron] days-before-departure sweep failed:", err);
  }
  return summary;
}
