export type { EmailAccount, InsertEmailAccount } from "@shared/schema";

export interface EmailEnvelope {
  uid: number;
  subject: string | null;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  date: Date | null;
  messageId: string | null;
  inReplyTo: string | null;
}

export interface EmailMessage {
  uid: number;
  subject: string | null;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  date: Date | null;
  messageId: string | null;
  flags: Set<string>;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: string; // base64-encoded
}

export interface EmailMessageFull extends EmailMessage {
  html: string | null;
  text: string | null;
  attachments: EmailAttachment[];
}

export interface MailboxFolder {
  path: string;
  name: string;
  delimiter: string;
  flags: Set<string>;
}

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}
