import { afterEach, describe, it, expect, vi } from "vitest";
import { clearInstallPrompt, errorReason, platformFromUserAgent, rememberInstallPrompt, shouldAutoOpen, watchInstallPrompt, wizardOutcome, type InstallPromptEvent } from "./setup-wizard";

const fakePrompt = {} as InstallPromptEvent;

describe("watchInstallPrompt", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearInstallPrompt();
  });

  it("calls straight away when the prompt is already there", () => {
    rememberInstallPrompt(fakePrompt);
    const found = vi.fn();
    watchInstallPrompt(found);
    expect(found).toHaveBeenCalledTimes(1);
  });

  it("picks up a prompt that arrives later, once, and then stops watching", () => {
    vi.useFakeTimers();
    const found = vi.fn();
    watchInstallPrompt(found, 500);
    vi.advanceTimersByTime(1500);
    expect(found).not.toHaveBeenCalled();
    rememberInstallPrompt(fakePrompt);
    vi.advanceTimersByTime(500);
    expect(found).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(found).toHaveBeenCalledTimes(1);
  });

  it("stops when told to", () => {
    vi.useFakeTimers();
    const found = vi.fn();
    const stop = watchInstallPrompt(found, 500);
    stop();
    rememberInstallPrompt(fakePrompt);
    vi.advanceTimersByTime(2000);
    expect(found).not.toHaveBeenCalled();
  });
});

describe("platformFromUserAgent", () => {
  it("tells iPhone, Android and everything else apart", () => {
    expect(platformFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(platformFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("ios");
    expect(platformFromUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android");
    expect(platformFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(platformFromUserAgent("")).toBe("desktop");
  });
});

describe("shouldAutoOpen", () => {
  const base = { manualOnly: false, signedIn: true, alreadyDone: false, standalone: false };
  it("opens by itself only for a signed-in customer who has not finished it and has not installed the app", () => {
    expect(shouldAutoOpen(base)).toBe(true);
    expect(shouldAutoOpen({ ...base, manualOnly: true })).toBe(false);
    expect(shouldAutoOpen({ ...base, signedIn: false })).toBe(false);
    expect(shouldAutoOpen({ ...base, alreadyDone: true })).toBe(false);
    expect(shouldAutoOpen({ ...base, standalone: true })).toBe(false);
  });
});

describe("wizardOutcome", () => {
  it("is open until notifications are on", () => {
    expect(wizardOutcome({ notifStatus: "idle", installed: true, standalone: true, platform: "ios" })).toBe("open");
    expect(wizardOutcome({ notifStatus: "error", installed: false, standalone: false, platform: "android" })).toBe("open");
  });

  it("is all done once notifications are on and the app is installed, already standalone, or on desktop", () => {
    expect(wizardOutcome({ notifStatus: "done", installed: true, standalone: false, platform: "ios" })).toBe("all-done");
    expect(wizardOutcome({ notifStatus: "done", installed: false, standalone: true, platform: "android" })).toBe("all-done");
    expect(wizardOutcome({ notifStatus: "done", installed: false, standalone: false, platform: "desktop" })).toBe("all-done");
  });

  it("offers Continue when notifications are on but a phone has not installed the app", () => {
    expect(wizardOutcome({ notifStatus: "done", installed: false, standalone: false, platform: "ios" })).toBe("notifications-only");
  });
});

describe("errorReason", () => {
  it("uses the error's message, else the fallback", () => {
    expect(errorReason(new Error("Failed: 500"))).toBe("Failed: 500");
    expect(errorReason("x")).toBe("Something went wrong");
    expect(errorReason(new Error(""), "Nope")).toBe("Nope");
  });
});
