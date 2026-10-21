import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();

vi.mock("imapflow", () => ({
  ImapFlow: class {
    connect = vi.fn().mockResolvedValue(undefined);
    mailboxOpen = vi.fn().mockResolvedValue({ exists: 1 });
    logout = vi.fn().mockResolvedValue(undefined);
    fetch = fetchMock;
  },
}));

vi.mock("mailparser", () => ({
  simpleParser: vi.fn(),
}));

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));

vi.mock("../../utils/encryption", () => ({ encrypt: vi.fn(), decrypt: vi.fn(() => "pw") }));

vi.mock("./email.repository", () => ({
  emailRepository: { findById: vi.fn() },
}));

import { simpleParser } from "mailparser";
import { emailService } from "./email.service";
import { emailRepository } from "./email.repository";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(emailRepository.findById).mockResolvedValue({
    id: "a1",
    userId: "u1",
    imapHost: "h",
    imapPort: 993,
    secure: true,
    username: "u",
    encryptedPassword: "enc",
  } as never);
  fetchMock.mockImplementation(async function* () {
    yield { uid: 5, envelope: {}, flags: new Set<string>(), source: Buffer.from("x") };
  });
});

describe("emailService.fetchMessageById", () => {
  it("sanitises the inbound HTML body before returning it", async () => {
    vi.mocked(simpleParser).mockResolvedValue({
      html: '<p>Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">l</a>',
      text: "Hi",
      attachments: [],
    } as never);

    const result = await emailService.fetchMessageById("a1", "u1", 5);

    expect(result.html).toContain("<p>Hi</p>");
    expect(result.html).not.toMatch(/script|onerror|javascript:/i);
    expect(result.text).toBe("Hi");
  });

  it("returns null html when the message has none", async () => {
    vi.mocked(simpleParser).mockResolvedValue({ html: false, text: "plain", attachments: [] } as never);
    const result = await emailService.fetchMessageById("a1", "u1", 5);
    expect(result.html).toBeNull();
  });
});
