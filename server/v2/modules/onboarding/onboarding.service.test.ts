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
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "http://localhost:5000" }));
vi.mock("../../../services/email-provider", () => ({ getEmailProvider: () => ({ send: vi.fn() }) }));

import { onboardingService } from "./onboarding.service";
import { onboardingRepository } from "./onboarding.repository";
import { organizationRepository } from "../organization/organization.repository";
import { userRepository } from "../user/user.repository";

function branch(name = "Main") {
  return {
    name,
    address: "1 High St",
    phone: "0123",
    email: `${name}@acme.com`,
    openingPattern: "mon-fri",
    bankHolidaysOpen: false,
    openingHours: [],
  };
}

function payload(over: Record<string, unknown> = {}) {
  return {
    agencyName: "Acme Travel",
    slug: "acme-travel",
    ownerName: "Ada Lovelace",
    ownerEmail: "ada@acme.com",
    ownerPhone: "0123456789",
    password: "supersecret",
    branches: [branch()],
    agents: [],
    hasHomeworkers: false,
    ...over,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  // default: no conflicts
  vi.mocked(userRepository.findByEmail).mockResolvedValue(undefined as never);
  vi.mocked(organizationRepository.findBySlug).mockResolvedValue(undefined as never);
  vi.mocked(onboardingRepository.signupAgency).mockResolvedValue({
    orgId: "org1",
    ownerId: "u1",
    branchIds: ["b1"],
  } as never);
});

describe("onboardingService.signup — conflict guards", () => {
  it("rejects when the owner email already exists (409)", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: "existing" } as never);

    await expect(onboardingService.signup(payload())).rejects.toMatchObject({ statusCode: 409 });
    expect(onboardingRepository.signupAgency).not.toHaveBeenCalled();
  });

  it("rejects when the agency slug is taken (409)", async () => {
    vi.mocked(organizationRepository.findBySlug).mockResolvedValue({ id: "org-existing" } as never);

    await expect(onboardingService.signup(payload())).rejects.toMatchObject({ statusCode: 409 });
    expect(onboardingRepository.signupAgency).not.toHaveBeenCalled();
  });

  it("rejects when an agent email already exists (409)", async () => {
    // owner lookup passes (null), the agent lookup hits an existing user.
    vi.mocked(userRepository.findByEmail)
      .mockResolvedValueOnce(undefined as never) // owner
      .mockResolvedValueOnce({ id: "dupe" } as never); // agent

    await expect(
      onboardingService.signup(payload({ agents: [{ name: "Bob", email: "bob@x.com", role: "Agent", active: true, branchIndex: 0 }] })),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("onboardingService.signup — agency assembly", () => {
  it("creates the org (starter plan) with an org_admin owner and returns the ids", async () => {
    const result = await onboardingService.signup(payload());

    const arg = vi.mocked(onboardingRepository.signupAgency).mock.calls[0][0];
    expect(arg.organization).toMatchObject({ slug: "acme-travel", plan: "starter" });
    expect(arg.ownerUser).toMatchObject({ email: "ada@acme.com", orgRole: "org_admin", emailVerified: false });
    expect(result).toMatchObject({ orgId: "org1", userId: "u1", branchIds: ["b1"] });
  });

  it("maps agent job titles to org roles (Manager → branch_manager)", async () => {
    await onboardingService.signup(
      payload({ agents: [{ name: "Bob Boss", email: "bob@x.com", role: "Manager", active: true, branchIndex: 0 }] }),
    );

    const arg = vi.mocked(onboardingRepository.signupAgency).mock.calls[0][0];
    expect(arg.agents[0].branchMemberRoleAndActive.orgRole).toBe("branch_manager");
    expect(arg.agents[0].user.orgRole).toBe("branch_manager");
  });

  it("appends a Homeworkers branch when hasHomeworkers is set", async () => {
    await onboardingService.signup(payload({ hasHomeworkers: true, homeworkerCommission: 50 }));

    const arg = vi.mocked(onboardingRepository.signupAgency).mock.calls[0][0];
    expect(arg.branchInputs).toHaveLength(2); // 1 real branch + Homeworkers
    expect(arg.branchInputs[1]).toMatchObject({ name: "Homeworkers", branchType: "homeworker" });
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
  it("rejects an unknown token (400)", async () => {
    vi.mocked(userRepository.findByVerificationToken).mockResolvedValue(undefined as never);

    await expect(onboardingService.verifyEmail("nope")).rejects.toMatchObject({ statusCode: 400 });
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
