import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const providerSend = vi.hoisted(() => vi.fn());
vi.mock("../../../services/email-provider", () => ({ getEmailProvider: () => ({ send: providerSend }) }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.travana.co.uk" }));

import { sendInviteEmail } from "./invite-email.service";

const originalEnv = { ...process.env };

beforeEach(() => {
  providerSend.mockReset();
  delete process.env.REPLIT_DEPLOYMENT;
  delete process.env.REPLIT_DEPLOYMENT_ID;
  process.env.NODE_ENV = "test";
});
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("sendInviteEmail link base", () => {
  it("uses the request origin outside production", async () => {
    await sendInviteEmail("a@b.com", "Org", "tok", "http://localhost:5000");
    expect(providerSend.mock.calls[0][0].text).toContain("http://localhost:5000/accept-invite?token=tok");
  });

  it("uses the configured URL when no origin is passed", async () => {
    await sendInviteEmail("a@b.com", "Org", "tok");
    expect(providerSend.mock.calls[0][0].text).toContain("https://app.travana.co.uk/accept-invite?token=tok");
  });

  it("ignores the request origin in production", async () => {
    process.env.NODE_ENV = "production";
    await sendInviteEmail("a@b.com", "Org", "tok", "https://evil.example");
    const { text } = providerSend.mock.calls[0][0];
    expect(text).toContain("https://app.travana.co.uk/accept-invite?token=tok");
    expect(text).not.toContain("evil.example");
  });
});
