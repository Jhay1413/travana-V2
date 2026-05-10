import type { EmailProvider, EmailMessage } from "./email-provider.types";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(private readonly apiKey: string, private readonly defaultFrom: string) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
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
