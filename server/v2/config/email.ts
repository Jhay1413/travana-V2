// Stub — wire up your email provider (Resend, SendGrid, etc.)
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(_payload: EmailPayload): Promise<void> {
  // TODO: implement with chosen email provider
  throw new Error('Email service not configured');
}
