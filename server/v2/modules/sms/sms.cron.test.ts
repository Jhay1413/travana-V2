import { describe, it, expect, vi, beforeEach } from "vitest";

const schedule = vi.hoisted(() => vi.fn());
vi.mock("node-cron", () => ({ default: { schedule } }));
vi.mock("./sms.repository", () => ({
  smsRepository: {
    runWithAdvisoryLock: vi.fn(),
    findAllActiveTemplatesByTrigger: vi.fn(),
    findActiveBookingsByTravelDate: vi.fn(),
  },
}));
vi.mock("./sms.service", () => ({ fireAutoTriggerForClient: vi.fn() }));

import { runDaysBeforeDepartureSweep, startDepartureSweepScheduler, DEPARTURE_SWEEP_LOCK_KEY } from "./sms.cron";
import { smsRepository as repo } from "./sms.repository";
import { fireAutoTriggerForClient } from "./sms.service";

const NOW = new Date("2026-11-02T09:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  // Behave like the real lock when it is free: run the work.
  vi.mocked(repo.runWithAdvisoryLock).mockImplementation((async (_key: number, work: (lock: { isHeld(): boolean }) => Promise<unknown>) => ({
    acquired: true,
    result: await work({ isHeld: () => true }),
  })) as never);
  vi.mocked(fireAutoTriggerForClient).mockResolvedValue({ sent: 1, skipped: 0, failed: 0 });
});

describe("startDepartureSweepScheduler", () => {
  it("does not schedule when the flag is unset, and logs OFF once", () => {
    const log = vi.fn();
    expect(startDepartureSweepScheduler({}, log)).toBe(false);
    expect(schedule).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]![0]).toContain("OFF");
  });

  it("does not schedule for any value other than true", () => {
    expect(startDepartureSweepScheduler({ SMS_DEPARTURE_SWEEP_ENABLED: "1" }, vi.fn())).toBe(false);
    expect(schedule).not.toHaveBeenCalled();
  });

  it("schedules 09:00 Europe/London when enabled, and logs ON once", () => {
    const log = vi.fn();
    expect(startDepartureSweepScheduler({ SMS_DEPARTURE_SWEEP_ENABLED: "true" }, log)).toBe(true);
    expect(schedule).toHaveBeenCalledWith("0 9 * * *", expect.any(Function), { timezone: "Europe/London" });
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]![0]).toContain("ON");
  });
});

describe("runDaysBeforeDepartureSweep", () => {
  it("does nothing when another instance holds the lock", async () => {
    vi.mocked(repo.runWithAdvisoryLock).mockResolvedValue({ acquired: false });
    const summary = await runDaysBeforeDepartureSweep(NOW);
    expect(repo.runWithAdvisoryLock).toHaveBeenCalledWith(DEPARTURE_SWEEP_LOCK_KEY, expect.any(Function));
    expect(summary.lockAcquired).toBe(false);
    expect(fireAutoTriggerForClient).not.toHaveBeenCalled();
    expect(repo.findAllActiveTemplatesByTrigger).not.toHaveBeenCalled();
  });

  it("does nothing without active templates", async () => {
    vi.mocked(repo.findAllActiveTemplatesByTrigger).mockResolvedValue([]);
    const summary = await runDaysBeforeDepartureSweep(NOW);
    expect(summary).toMatchObject({ templatesChecked: 0, sent: 0 });
    expect(repo.findActiveBookingsByTravelDate).not.toHaveBeenCalled();
  });

  it("scans exactly UK today + n per distinct value and fires only that day count with the UK-day dedupe window", async () => {
    vi.mocked(repo.findAllActiveTemplatesByTrigger).mockResolvedValue([
      { triggerDaysBefore: 14 }, { triggerDaysBefore: 14 }, { triggerDaysBefore: 7 },
    ] as never);
    vi.mocked(repo.findActiveBookingsByTravelDate).mockImplementation((async (d: string) =>
      d === "2026-11-09" ? [{ bookingId: "b7", clientId: "c7" }, { bookingId: "bx", clientId: null }] : []) as never);

    const summary = await runDaysBeforeDepartureSweep(NOW);

    expect(vi.mocked(repo.findActiveBookingsByTravelDate).mock.calls.map((c) => c[0])).toEqual(["2026-11-09", "2026-11-16"]);
    expect(fireAutoTriggerForClient).toHaveBeenCalledTimes(1);
    expect(fireAutoTriggerForClient).toHaveBeenCalledWith({
      clientId: "c7",
      bookingId: "b7",
      autoTrigger: "days_before_departure",
      triggerDaysBefore: 7,
      triggerSource: "cron.days_before_departure.7",
      dedupeSince: new Date("2026-11-02T00:00:00.000Z"),
    });
    expect(summary).toMatchObject({ templatesChecked: 3, bookingsMatched: 2, sent: 1, lockAcquired: true });
  });

  it("counts bookings skipped for a suspended organisation, and only sends for the active one", async () => {
    vi.mocked(repo.findAllActiveTemplatesByTrigger).mockResolvedValue([{ triggerDaysBefore: 7 }] as never);
    vi.mocked(repo.findActiveBookingsByTravelDate).mockResolvedValue([
      { bookingId: "b1", clientId: "suspended-client" }, { bookingId: "b2", clientId: "active-client" },
    ] as never);
    vi.mocked(fireAutoTriggerForClient).mockImplementation((async (o: { clientId: string }) =>
      o.clientId === "suspended-client"
        ? { sent: 0, skipped: 1, failed: 0, suspended: true }
        : { sent: 1, skipped: 0, failed: 0 }) as never);

    const summary = await runDaysBeforeDepartureSweep(NOW);

    expect(summary).toMatchObject({ sent: 1, skipped: 1, suspendedSkipped: 1 });
  });

  it("stops with a logged message when the lock connection drops mid-run", async () => {
    let held = true;
    vi.mocked(repo.runWithAdvisoryLock).mockImplementation((async (_key: number, work: (lock: { isHeld(): boolean }) => Promise<unknown>) => ({
      acquired: true,
      result: await work({ isHeld: () => held }),
    })) as never);
    vi.mocked(repo.findAllActiveTemplatesByTrigger).mockResolvedValue([{ triggerDaysBefore: 7 }] as never);
    vi.mocked(repo.findActiveBookingsByTravelDate).mockResolvedValue([
      { bookingId: "b1", clientId: "c1" }, { bookingId: "b2", clientId: "c2" },
    ] as never);
    vi.mocked(fireAutoTriggerForClient).mockImplementation((async () => {
      held = false; // the connection drops while texting the first client
      return { sent: 1, skipped: 0, failed: 0 };
    }) as never);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const summary = await runDaysBeforeDepartureSweep(NOW);

    expect(fireAutoTriggerForClient).toHaveBeenCalledTimes(1);
    expect(summary.sent).toBe(1);
    expect(spy.mock.calls.flat().join(" ")).toContain("advisory lock connection was lost");
    spy.mockRestore();
  });

  it("never throws when the database fails", async () => {
    vi.mocked(repo.runWithAdvisoryLock).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(runDaysBeforeDepartureSweep(NOW)).resolves.toMatchObject({ sent: 0 });
    spy.mockRestore();
  });
});
