import type { EmailProvider, EmailMessage } from "./email-provider.types";

const SEND_TIMEOUT_MS = 10_000;

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(private readonly apiKey: string, private readonly defaultFrom: string) {}

  async send(message: EmailMessage): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      await this.post(message, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`Resend send timed out after ${SEND_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async post(message: EmailMessage, signal: AbortSignal): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from ?? this.defaultFrom,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend send failed: ${response.status} ${body}`);
    }
  }
}
