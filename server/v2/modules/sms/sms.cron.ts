import cron from "node-cron";
import { smsRepository } from "./sms.repository";
import { fireAutoTriggerForClient } from "./sms.service";
import {
  DEPARTURE_SWEEP_CRON,
  DEPARTURE_SWEEP_ENV_VAR,
  DEPARTURE_SWEEP_TIMEZONE,
  isDepartureSweepEnabled,
  planDepartureSweep,
} from "./sms.schedule";

/** Arbitrary constant naming this job's Postgres advisory lock (shared by every server instance). */
export const DEPARTURE_SWEEP_LOCK_KEY = 7_319_042;

export interface DepartureSweepSummary {
  templatesChecked: number;
  bookingsMatched: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Bookings skipped because their organisation is suspended (a count only, no client data). */
  suspendedSkipped: number;
  /** False when another server instance held the lock, so this run did nothing. */
  lockAcquired: boolean;
}

/**
 * For every active template with autoTrigger='days_before_departure', find
 * bookings whose travel_date is exactly UK today + `triggerDaysBefore` and fire
 * the SMS templates configured for that many days, per client. Idempotent: a
 * re-run on the same UK day skips any (template, client) already auto-sent today.
 * Only one server instance sweeps at a time (advisory lock).
 *
 * Safe to call from a cron job: never throws; logs failures and moves on.
 */
export async function runDaysBeforeDepartureSweep(now: Date = new Date()): Promise<DepartureSweepSummary> {
  const summary: DepartureSweepSummary = { templatesChecked: 0, bookingsMatched: 0, sent: 0, skipped: 0, failed: 0, suspendedSkipped: 0, lockAcquired: true };
  try {
    const outcome = await smsRepository.runWithAdvisoryLock(DEPARTURE_SWEEP_LOCK_KEY, async (lock) => {
      const templates = await smsRepository.findAllActiveTemplatesByTrigger("days_before_departure");
      summary.templatesChecked = templates.length;
      if (templates.length === 0) return;

      const plan = planDepartureSweep(now, templates.map((t) => t.triggerDaysBefore));
      for (const { daysBefore, travelDate } of plan.targets) {
        const bookings = await smsRepository.findActiveBookingsByTravelDate(travelDate);
        summary.bookingsMatched += bookings.length;

        for (const row of bookings) {
          // The lock lives on one connection; if it dropped, another instance may now be
          // sweeping, so stop here. hasRecentAutoSend keeps a re-run from double-texting.
          if (!lock.isHeld()) {
            console.error("[sms.cron] sweep stopped: the advisory lock connection was lost");
            return;
          }
          if (!row.clientId) continue;
          const result = await fireAutoTriggerForClient({
            clientId: row.clientId,
            bookingId: row.bookingId,
            autoTrigger: "days_before_departure",
            triggerDaysBefore: daysBefore,
            triggerSource: `cron.days_before_departure.${daysBefore}`,
            dedupeSince: plan.dedupeSince,
          });
          if (result.suspended) summary.suspendedSkipped += 1;
          summary.sent += result.sent;
          summary.skipped += result.skipped;
          summary.failed += result.failed;
        }
      }
    });
    if (!outcome.acquired) summary.lockAcquired = false;
  } catch (err) {
    console.error("[sms.cron] days-before-departure sweep failed:", err);
  }
  return summary;
}

/**
 * Starts the 09:00 UK daily sweep when SMS_DEPARTURE_SWEEP_ENABLED=true, and logs
 * which way it went. Off by default: enabling it texts real clients.
 */
export function startDepartureSweepScheduler(
  env: Record<string, string | undefined> = process.env,
  log: (message: string) => void = console.log,
): boolean {
  if (!isDepartureSweepEnabled(env)) {
    log(`[sms.cron] departure reminder sweep is OFF (set ${DEPARTURE_SWEEP_ENV_VAR}=true to enable)`);
    return false;
  }
  cron.schedule(
    DEPARTURE_SWEEP_CRON,
    async () => {
      const summary = await runDaysBeforeDepartureSweep();
      log(`[sms.cron] days-before-departure: ${JSON.stringify(summary)}`);
    },
    { timezone: DEPARTURE_SWEEP_TIMEZONE },
  );
  log(`[sms.cron] departure reminder sweep is ON (daily 09:00 ${DEPARTURE_SWEEP_TIMEZONE})`);
  return true;
}
