import { z } from "zod";

const emailAccountBase = z.object({
  label: z.string().min(1, "Label is required"),
  emailAddress: z.string().email("Invalid email address"),
  imapHost: z.string().min(1, "IMAP host is required"),
  imapPort: z.number().int().min(1).max(65535).default(993),
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(true),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const createEmailAccountValidator = z.object({
  body: emailAccountBase.extend({
    userId: z.string().min(1, "User ID is required"),
  }),
});

export const updateEmailAccountValidator = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: emailAccountBase.partial(),
});

export const sendEmailValidator = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1, "Subject is required"),
    html: z.string().optional(),
    text: z.string().optional(),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    replyTo: z.string().email().optional(),
  }),
});

export const fetchMessagesValidator = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    folder: z.string().optional().default("INBOX"),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const fetchMessageByIdValidator = z.object({
  params: z.object({
    id: z.string().min(1),
    uid: z.coerce.number().int().min(1),
  }),
  query: z.object({
    folder: z.string().optional().default("INBOX"),
  }),
});
