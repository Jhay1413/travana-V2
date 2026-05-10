import type { EmailProvider, EmailMessage } from "./email-provider.types";

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<void> {
    console.log("\n[email:console] ───────────────────────────────");
    console.log(`  to:      ${message.to}`);
    console.log(`  from:    ${message.from ?? "no-reply@travelhub.local"}`);
    console.log(`  subject: ${message.subject}`);
    if (message.text) console.log(`  text:    ${message.text}`);
    console.log(`  html:\n${message.html.split("\n").map((l) => `    ${l}`).join("\n")}`);
    console.log("───────────────────────────────────────────────\n");
  }
}
