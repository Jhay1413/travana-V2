import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./onboarding.repository", () => ({ onboardingRepository: { signupAgency: vi.fn() } }));
vi.mock("../organization/organization.repository", () => ({ organizationRepository: { findBySlug: vi.fn() } }));
vi.mock("../user/user.repository", () => ({
  userRepository: {
    findByEmail: vi.fn(),
    update: vi.fn(),
    findByVerificationToken: vi.fn(),
  },
}));
vi.mock("../plan/plan.repository", () => ({ planRepository: { findByCode: vi.fn() } }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "http://localhost:5000" }));
const providerSend = vi.hoisted(() => vi.fn());
const providerName = vi.hoisted(() => ({ value: "resend" }));
vi.mock("../../../services/email-provider", () => ({
  getEmailProvider: () => ({ name: providerName.value, send: providerSend }),
  isRealEmailProvider: (p: { name: string }) => p.name !== "console",
}));

import { onboardingService, slugifyBusinessName } from "./onboarding.service";
import { onboardingRepository } from "./onboarding.repository";
import { organizationRepository } from "../organization/organization.repository";
import { userRepository } from "../user/user.repository";
import { planRepository } from "../plan/plan.repository";

function payload(over: Record<string, unknown> = {}) {
  return {
    businessName: "Acme Travel",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "Ada@acme.com",
    password: "supersecret",
    ...over,
  } as never;
}

function lastInput() {
  return vi.mocked(onboardingRepository.signupAgency).mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  providerName.value = "resend";
  providerSend.mockResolvedValue(undefined);
  vi.mocked(planRepository.findByCode).mockResolvedValue({ code: "starter", seatLimit: 15 } as never);
  vi.mocked(userRepository.findByEmail).mockResolvedValue(undefined as never);
  vi.mocked(organizationRepository.findBySlug).mockResolvedValue(null);
  vi.mocked(onboardingRepository.signupAgency).mockResolvedValue({
    orgId: "org1",
    ownerId: "u1",
    branchIds: ["b1"],
  } as never);
});

describe("slugifyBusinessName", () => {
  it("lowercases, hyphenates and strips accents and punctuation", () => {
    expect(slugifyBusinessName("  Café Voyages & Co.! ")).toBe("cafe-voyages-co");
  });

  it("pads names that are too short and falls back for non-latin names", () => {
    expect(slugifyBusinessName("AB")).toBe("ab-agency");
    expect(slugifyBusinessName("旅行")).toBe("agency");
  });

  it("stays within 40 characters even with a collision suffix", () => {
    const slug = slugifyBusinessName("x".repeat(100));
    expect(slug.length + "-50".length).toBeLessThanOrEqual(40);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("onboardingService verification links", () => {
  it("points the signup email at the requesting origin outside production", async () => {
    await onboardingService.signup(payload(), "https://dev.example.repl.co");
    const { text } = providerSend.mock.calls[0][0] as { text: string };
    expect(text).toContain("https://dev.example.repl.co/verify-email?token=");
  });

  it("points the resend email at the requesting origin outside production", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({
      id: "u1",
      name: "Ada",
      emailVerified: false,
      verificationTokenExpiry: null,
    } as never);
    await onboardingService.resendVerification("ada@acme.com", "http://localhost:5173");
    const { text } = providerSend.mock.calls[0][0] as { text: string };
    expect(text).toContain("http://localhost:5173/verify-email?token=");
  });
});

describe("onboardingService.signup", () => {
  it("rejects when the owner email already exists (409)", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: "existing" } as never);

    await expect(onboardingService.signup(payload())).rejects.toMatchObject({ statusCode: 409 });
    expect(onboardingRepository.signupAgency).not.toHaveBeenCalled();
  });

  it("generates the slug from the business name", async () => {
    await onboardingService.signup(payload());
    expect(lastInput().organization.slug).toBe("acme-travel");
  });

  it("appends -2, -3 on slug collision", async () => {
    vi.mocked(organizationRepository.findBySlug).mockImplementation(async (slug: string) =>
      slug === "acme-travel" || slug === "acme-travel-2" ? ({ id: "x" } as never) : null,
    );

    await onboardingService.signup(payload());
    expect(lastInput().organization.slug).toBe("acme-travel-3");
  });

  it("creates ONE default branch named after the business with the owner email and default hours", async () => {
    await onboardingService.signup(payload());
    const input = lastInput();

    expect(input.branchInput).toMatchObject({
      name: "Acme Travel",
      email: "ada@acme.com",
      phone: "",
      address: "",
      branchType: "shop",
      openingPattern: "mon-fri",
      bankHolidaysOpen: false,
    });
    const hours = input.branchInput.openingHours as Array<{ day: string; open: boolean; openTime: string; closeTime: string }>;
    expect(hours).toHaveLength(7);
    expect(hours.slice(0, 5).every((h) => h.open && h.openTime === "08:00" && h.closeTime === "17:00")).toBe(true);
    expect(hours.slice(5).every((h) => !h.open)).toBe(true);
    expect(input).not.toHaveProperty("agents");
  });

  it("creates an org_admin owner with no phone and marks onboarding pending", async () => {
    const result = await onboardingService.signup(payload());
    const input = lastInput();

    expect(input.organization).toMatchObject({
      name: "Acme Travel",
      plan: "starter",
      seatLimit: 15,
      homeworkerCommission: null,
      settings: { onboarding: { status: "pending", version: 1 } },
    });
    expect(input.ownerUser).toMatchObject({
      email: "ada@acme.com",
      name: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      phoneNumber: "",
      orgRole: "org_admin",
      emailVerified: false,
    });
    expect(input.ownerUser.password).not.toBe("supersecret");
    expect(result).toMatchObject({
      orgId: "org1",
      userId: "u1",
      branchIds: ["b1"],
      message: "Agency created — check your email to verify your account",
    });
  });

  const slugClash = () => Object.assign(new Error("dup"), { code: "23505", constraint: "organization_slug_unique" });

  it("retries a slug race with a new random suffix and succeeds", async () => {
    vi.mocked(onboardingRepository.signupAgency)
      .mockRejectedValueOnce(slugClash())
      .mockResolvedValueOnce({ orgId: "org1", ownerId: "u1", branchIds: ["b1"] } as never);

    await expect(onboardingService.signup(payload())).resolves.toMatchObject({ orgId: "org1" });

    const slugs = vi.mocked(onboardingRepository.signupAgency).mock.calls.map((c) => c[0].organization.slug);
    expect(slugs[0]).toBe("acme-travel");
    expect(slugs[1]).toMatch(/^acme-travel-[0-9a-f]{6}$/);
  });

  it("gives up with 409 after 3 slug-race attempts", async () => {
    vi.mocked(onboardingRepository.signupAgency).mockRejectedValue(slugClash());

    await expect(onboardingService.signup(payload())).rejects.toMatchObject({ statusCode: 409 });
    expect(onboardingRepository.signupAgency).toHaveBeenCalledTimes(3);
  });

  it("409s immediately, without retrying, when the clash is the user email", async () => {
    vi.mocked(onboardingRepository.signupAgency).mockRejectedValue(
      Object.assign(new Error("dup"), { code: "23505", constraint: "user_email_unique" }),
    );

    await expect(onboardingService.signup(payload())).rejects.toMatchObject({
      statusCode: 409,
      message: "An account with this email already exists",
    });
    expect(onboardingRepository.signupAgency).toHaveBeenCalledTimes(1);
  });

  it("finds the violation through a wrapped cause", async () => {
    vi.mocked(onboardingRepository.signupAgency).mockRejectedValue(
      Object.assign(new Error("wrapped"), { cause: { code: "23505", constraint: "user_email_key" } }),
    );
    await expect(onboardingService.signup(payload())).rejects.toMatchObject({ statusCode: 409 });
    expect(onboardingRepository.signupAgency).toHaveBeenCalledTimes(1);
  });

  it("falls back to a random suffix after five sequential slug lookups", async () => {
    vi.mocked(organizationRepository.findBySlug).mockResolvedValue({ id: "x" } as never);

    await onboardingService.signup(payload());

    expect(organizationRepository.findBySlug).toHaveBeenCalledTimes(5);
    expect(lastInput().organization.slug).toMatch(/^acme-travel-[0-9a-f]{6}$/);
  });

  it("rethrows other repository errors untouched", async () => {
    vi.mocked(onboardingRepository.signupAgency).mockRejectedValue(new Error("db down"));

    await expect(onboardingService.signup(payload())).rejects.toThrow("db down");
  });

  it("reports emailSent=true only for a real provider that did not throw", async () => {
    expect((await onboardingService.signup(payload())).emailSent).toBe(true);

    providerName.value = "console";
    expect((await onboardingService.signup(payload())).emailSent).toBe(false);

    providerName.value = "resend";
    providerSend.mockRejectedValue(new Error("smtp"));
    expect((await onboardingService.signup(payload())).emailSent).toBe(false);
  });

  it("escapes the owner name in the verification email HTML", async () => {
    await onboardingService.signup(payload({ firstName: "<script>alert(1)</script>" }));

    const sent = providerSend.mock.calls[0][0] as { html: string };
    expect(sent.html).not.toContain("<script>");
  });

  it("with no starter plan row: seatLimit explicitly null and a warning", async () => {
    vi.mocked(planRepository.findByCode).mockResolvedValue(null as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await onboardingService.signup(payload());
    expect(lastInput().organization).toHaveProperty("seatLimit", null);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("onboardingService.resendVerification", () => {
  it("no-ops for an unknown email (no enumeration leak)", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(undefined as never);

    await expect(onboardingService.resendVerification("ghost@x.com")).resolves.toBeUndefined();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("no-ops for an already-verified user", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: "u1", emailVerified: true } as never);

    await onboardingService.resendVerification("ada@acme.com");
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("rate-limits a too-soon resend (429)", async () => {
    // token was just issued → expiry ~ now + TTL → still inside the cooldown window
    vi.mocked(userRepository.findByEmail).mockResolvedValue({
      id: "u1",
      emailVerified: false,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as never);

    await expect(onboardingService.resendVerification("ada@acme.com")).rejects.toMatchObject({ statusCode: 429 });
  });

  it("issues a fresh token when eligible", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({
      id: "u1",
      name: "Ada",
      emailVerified: false,
      verificationTokenExpiry: null,
    } as never);

    await onboardingService.resendVerification("ada@acme.com");

    expect(userRepository.update).toHaveBeenCalledOnce();
    expect(vi.mocked(userRepository.update).mock.calls[0][1]).toHaveProperty("verificationToken");
  });
});

describe("onboardingService.verifyEmail", () => {
  it("rejects an unknown token (400) with VERIFICATION_LINK_INVALID", async () => {
    vi.mocked(userRepository.findByVerificationToken).mockResolvedValue(undefined as never);

    await expect(onboardingService.verifyEmail("nope")).rejects.toMatchObject({
      statusCode: 400,
      code: "VERIFICATION_LINK_INVALID",
    });
  });

  it("rejects an expired token (400)", async () => {
    vi.mocked(userRepository.findByVerificationToken).mockResolvedValue({
      id: "u1",
      verificationTokenExpiry: new Date(Date.now() - 1000),
    } as never);

    await expect(onboardingService.verifyEmail("stale")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("marks the user verified and clears the token", async () => {
    vi.mocked(userRepository.findByVerificationToken).mockResolvedValue({
      id: "u1",
      verificationTokenExpiry: new Date(Date.now() + 1000),
    } as never);

    await onboardingService.verifyEmail("good");

    expect(vi.mocked(userRepository.update).mock.calls[0][1]).toMatchObject({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    });
  });
});

