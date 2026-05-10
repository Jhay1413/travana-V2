import type { EmailProvider } from "./email-provider.types";
import { ConsoleEmailProvider } from "./console.email-provider";
import { ResendEmailProvider } from "./resend.email-provider";

export type { EmailProvider, EmailMessage } from "./email-provider.types";

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const driver = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();

  switch (driver) {
    case "resend": {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM ?? "no-reply@travelhub.local";
      if (!apiKey) {
        console.warn("[email] EMAIL_PROVIDER=resend but RESEND_API_KEY missing — falling back to console");
        cached = new ConsoleEmailProvider();
        break;
      }
      cached = new ResendEmailProvider(apiKey, from);
      break;
    }
    case "console":
    default:
      cached = new ConsoleEmailProvider();
  }

  return cached;
}
