import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { emailRepository } from "../repositories/email.repository";
import { encrypt, decrypt } from "../utils/encryption";
import { AppError } from "../utils/error-handler";
import type { EmailAccount, EmailMessage, EmailMessageFull, MailboxFolder, SendEmailPayload } from "../types/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildImapClient(account: EmailAccount): ImapFlow {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.secure,
    auth: {
      user: account.username,
      pass: decrypt(account.encryptedPassword),
    },
    logger: false,
  });
}

async function withImap<T>(account: EmailAccount, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = buildImapClient(account);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

// ─── Account Management ───────────────────────────────────────────────────────

export const emailService = {
  async listAccounts(userId: string): Promise<Omit<EmailAccount, "encryptedPassword">[]> {
    const accounts = await emailRepository.findAllByUserId(userId);
    return accounts.map(({ encryptedPassword: _pwd, ...rest }) => rest);
  },

  async getAccount(id: string): Promise<Omit<EmailAccount, "encryptedPassword">> {
    const account = await emailRepository.findById(id);
    if (!account) throw new AppError("Email account not found", 404);
    const { encryptedPassword: _pwd, ...rest } = account;
    return rest;
  },

  async createAccount(data: {
    userId: string;
    label: string;
    emailAddress: string;
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
    secure: boolean;
    username: string;
    password: string;
  }): Promise<Omit<EmailAccount, "encryptedPassword">> {
    const { password, ...rest } = data;
    const encryptedPassword = encrypt(password);
    const account = await emailRepository.create({ ...rest, encryptedPassword });
    const { encryptedPassword: _pwd, ...safeAccount } = account;
    return safeAccount;
  },

  async updateAccount(
    id: string,
    data: Partial<{
      label: string;
      emailAddress: string;
      imapHost: string;
      imapPort: number;
      smtpHost: string;
      smtpPort: number;
      secure: boolean;
      username: string;
      password: string;
    }>,
  ): Promise<Omit<EmailAccount, "encryptedPassword">> {
    const existing = await emailRepository.findById(id);
    if (!existing) throw new AppError("Email account not found", 404);

    const { password, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };
    if (password) updateData.encryptedPassword = encrypt(password);

    const updated = await emailRepository.update(id, updateData as never);
    if (!updated) throw new AppError("Email account not found", 404);

    const { encryptedPassword: _pwd, ...safeAccount } = updated;
    return safeAccount;
  },

  async deleteAccount(id: string): Promise<void> {
    const existing = await emailRepository.findById(id);
    if (!existing) throw new AppError("Email account not found", 404);
    await emailRepository.remove(id);
  },

  // ─── IMAP Operations ────────────────────────────────────────────────────────

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const account = await emailRepository.findById(id);
    if (!account) throw new AppError("Email account not found", 404);

    try {
      await withImap(account, async (client) => {
        await client.mailboxOpen("INBOX");
      });
      return { success: true, message: "Connection successful" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      throw new AppError(`IMAP connection failed: ${message}`, 502);
    }
  },

  async listFolders(id: string): Promise<MailboxFolder[]> {
    const account = await emailRepository.findById(id);
    if (!account) throw new AppError("Email account not found", 404);

    return withImap(account, async (client) => {
      const list = await client.list();
      return list.map((mb) => ({
        path: mb.path,
        name: mb.name,
        delimiter: mb.delimiter ?? "/",
        flags: mb.flags,
      }));
    });
  },

  async fetchMessages(id: string, folder = "INBOX", limit = 20): Promise<EmailMessage[]> {
    const account = await emailRepository.findById(id);
    if (!account) throw new AppError("Email account not found", 404);

    return withImap(account, async (client) => {
      const mailbox = await client.mailboxOpen(folder);
      if (mailbox.exists === 0) return [];

      const start = Math.max(1, mailbox.exists - limit + 1);
      const range = `${start}:*`;

      const messages: EmailMessage[] = [];
      for await (const msg of client.fetch(range, { envelope: true, flags: true })) {
        const envelope = msg.envelope ?? {};
        messages.push({
          uid: msg.uid,
          subject: envelope.subject ?? null,
          from: (envelope.from ?? []).map((a) => ({ name: a.name ?? "", address: a.address ?? "" })),
          to: (envelope.to ?? []).map((a) => ({ name: a.name ?? "", address: a.address ?? "" })),
          date: envelope.date ?? null,
          messageId: envelope.messageId ?? null,
          flags: Array.from(msg.flags ?? []) as unknown as Set<string>,
        });
      }

      return messages.reverse();
    });
  },

  async fetchMessageById(id: string, uid: number, folder = "INBOX"): Promise<EmailMessageFull> {
    const account = await emailRepository.findById(id);
    if (!account) throw new AppError("Email account not found", 404);

    return withImap(account, async (client) => {
      await client.mailboxOpen(folder);

      let result: EmailMessageFull | null = null;

      for await (const msg of client.fetch({ uid: uid }, { envelope: true, flags: true, bodyStructure: true, source: true }, { uid: true })) {
        const envelope = msg.envelope ?? {};
        const source = msg.source?.toString("utf8") ?? "";

        // Parse plain text and HTML from raw source (basic extraction)
        const htmlMatch = source.match(/<html[\s\S]*<\/html>/i);
        const html = htmlMatch ? htmlMatch[0] : null;
        const text = html ? null : source.replace(/^[\s\S]*?\r?\n\r?\n/, "").trim() || null;

        result = {
          uid: msg.uid,
          subject: envelope.subject ?? null,
          from: (envelope.from ?? []).map((a) => ({ name: a.name ?? "", address: a.address ?? "" })),
          to: (envelope.to ?? []).map((a) => ({ name: a.name ?? "", address: a.address ?? "" })),
          date: envelope.date ?? null,
          messageId: envelope.messageId ?? null,
          flags: Array.from(msg.flags ?? []) as unknown as Set<string>,
          html,
          text,
        };
      }

      if (!result) throw new AppError("Message not found", 404);
      return result;
    });
  },

  // ─── SMTP Operations ────────────────────────────────────────────────────────

  async sendEmail(id: string, payload: SendEmailPayload): Promise<{ messageId: string }> {
    const account = await emailRepository.findById(id);
    if (!account) throw new AppError("Email account not found", 404);

    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpPort === 465,
      auth: {
        user: account.username,
        pass: decrypt(account.encryptedPassword),
      },
    });

    try {
      const info = await transporter.sendMail({
        from: `<${account.emailAddress}>`,
        to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
        cc: payload.cc ? (Array.isArray(payload.cc) ? payload.cc.join(", ") : payload.cc) : undefined,
        bcc: payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc.join(", ") : payload.bcc) : undefined,
        replyTo: payload.replyTo,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      return { messageId: info.messageId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Send failed";
      throw new AppError(`SMTP send failed: ${message}`, 502);
    }
  },
};
