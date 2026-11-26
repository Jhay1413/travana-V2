/** Rules and browser facts for the install-app / notifications set-up wizard. */

export type Platform = "ios" | "android" | "desktop";

export const WIZARD_KEY = "portal_setup_wizard_done";

/** Fired by the Account page's "Install app" row to reopen the wizard on demand. */
export const OPEN_SETUP_WIZARD_EVENT = "portal:open-setup-wizard";

export function platformFromUserAgent(ua: string): Platform {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function detectPlatform(): Platform {
  return platformFromUserAgent(navigator.userAgent || "");
}

interface StandaloneNavigator extends Navigator {
  /** Safari on iPhone sets this when the page was opened from the Home Screen. */
  standalone?: boolean;
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as StandaloneNavigator).standalone === true;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The browser's install prompt, which Chrome and Edge hand over once and which the wizard keeps until it is used. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredInstallPrompt: InstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    rememberInstallPrompt(e as InstallPromptEvent);
  });
}

/** Keeps the browser's install prompt until the wizard uses it. */
export function rememberInstallPrompt(prompt: InstallPromptEvent): void {
  deferredInstallPrompt = prompt;
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return deferredInstallPrompt;
}

export function clearInstallPrompt(): void {
  deferredInstallPrompt = null;
}

/**
 * Calls `onFound` once the browser has handed over an install prompt (it can arrive after the page, even after the
 * wizard is open), checking every `everyMs`. Returns the function that stops watching. Calls straight away when the
 * prompt is already there.
 */
export function watchInstallPrompt(onFound: () => void, everyMs = 500): () => void {
  if (getInstallPrompt()) {
    onFound();
    return () => undefined;
  }
  const timer = setInterval(() => {
    if (getInstallPrompt()) {
      clearInterval(timer);
      onFound();
    }
  }, everyMs);
  return () => clearInterval(timer);
}

/**
 * Whether the wizard opens by itself: only on Home (not `manualOnly`), for a signed-in customer who has not
 * finished or skipped it on this device, and not when the app is already installed.
 */
export function shouldAutoOpen(input: { manualOnly: boolean; signedIn: boolean; alreadyDone: boolean; standalone: boolean }): boolean {
  if (input.manualOnly || !input.signedIn || input.alreadyDone || input.standalone) return false;
  return true;
}

export type NotifStatus = "idle" | "loading" | "done" | "error";

/** Which closing state the wizard is in: everything done, notifications done but the app not installed, or still setting up. */
export function wizardOutcome(input: { notifStatus: NotifStatus; installed: boolean; standalone: boolean; platform: Platform }): "all-done" | "notifications-only" | "open" {
  if (input.notifStatus !== "done") return "open";
  return input.installed || input.standalone || input.platform === "desktop" ? "all-done" : "notifications-only";
}

/** A readable reason from whatever was thrown. */
export function errorReason(error: unknown, fallback = "Something went wrong"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
