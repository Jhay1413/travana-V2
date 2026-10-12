import type { EmailProvider } from "./email-provider.types";
import { ConsoleEmailProvider } from "./console.email-provider";
import { ResendEmailProvider } from "./resend.email-provider";

export type { EmailProvider, EmailMessage } from "./email-provider.types";

let cached: EmailProvider | null = null;
let warnedNotConfigured = false;

function isProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID)
  );
}

function warnNotConfigured(reason: string): void {
  if (isProduction()) {
    console.error(`[email] ${reason} — emails will NOT be delivered (console fallback in use)`);
  } else if (!warnedNotConfigured) {
    console.warn(`[email] ${reason} — falling back to console`);
  }
  warnedNotConfigured = true;
}

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const driver = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();

  if (driver === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Do not cache: re-check on every call so adding the key takes effect and
      // the misconfiguration stays loud.
      warnNotConfigured("EMAIL_PROVIDER=resend but RESEND_API_KEY is missing");
      return new ConsoleEmailProvider();
    }
    cached = new ResendEmailProvider(apiKey, process.env.EMAIL_FROM ?? "no-reply@travana.app");
    return cached;
  }

  if (isProduction()) {
    warnNotConfigured("EMAIL_PROVIDER is not set to a real sender");
  }
  cached = new ConsoleEmailProvider();
  return cached;
}

/** True when the provider actually delivers mail (i.e. not the console fallback). */
export function isRealEmailProvider(provider: EmailProvider): boolean {
  return provider.name !== "console";
}
