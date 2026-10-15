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
const providerSend = vi.hoisted(() => vi.fn());
const providerName = vi.hoisted(() => ({ value: "resend" }));
vi.mock("../../../services/email-provider", () => ({
  getEmailProvider: () => ({ name: providerName.value, send: providerSend }),
  isRealEmailProvider: (p: { name: string }) => p.name !== "console",
}));
vi.mock("../invite/invite.service", () => ({
  INVITE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  inviteService: { sendInviteEmail: vi.fn() },
}));

import { onboardingService } from "./onboarding.service";
import { onboardingRepository } from "./onboarding.repository";
import { organizationRepository } from "../organization/organization.repository";
import { userRepository } from "../user/user.repository";
import { inviteService } from "../invite/invite.service";

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
  providerName.value = "resend";
  providerSend.mockResolvedValue(undefined);
  vi.mocked(inviteService.sendInviteEmail).mockResolvedValue(undefined);
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

describe("onboardingService.signup — agents are created as pending invites", () => {
  const bob = { name: "Bob Boss", email: "Bob@X.com", role: "Manager", active: true, branchIndex: 0 };

  it("creates agents with an invite token, no password, unverified and an inactive membership", async () => {
    await onboardingService.signup(payload({ agents: [bob] }));

    const arg = vi.mocked(onboardingRepository.signupAgency).mock.calls[0][0];
    const agent = arg.agents[0];
    expect(agent.user).toMatchObject({
      email: "bob@x.com",
      emailVerified: false,
      invitedBy: arg.ownerUser.id,
      inviteAgencyName: "Acme Travel",
    });
    expect(agent.user.password).toBeUndefined();
    expect(typeof agent.user.inviteToken).toBe("string");
    expect(agent.user.inviteTokenExpiry).toBeInstanceOf(Date);
    expect(agent.branchMemberRoleAndActive.isActive).toBe(false);
  });

  it("sends each agent an invite email via the invite service after the transaction", async () => {
    await onboardingService.signup(payload({ agents: [bob] }));

    const arg = vi.mocked(onboardingRepository.signupAgency).mock.calls[0][0];
    expect(inviteService.sendInviteEmail).toHaveBeenCalledWith("bob@x.com", "Acme Travel", arg.agents[0].user.inviteToken);
  });

  it("does not fail signup when an agent invite email throws", async () => {
    vi.mocked(inviteService.sendInviteEmail).mockRejectedValue(new Error("boom"));

    await expect(onboardingService.signup(payload({ agents: [bob] }))).resolves.toMatchObject({ orgId: "org1" });
  });

  it("rejects duplicate agent emails case-insensitively (409) before touching the DB", async () => {
    const dupes = [bob, { ...bob, name: "Bobby", email: "bob@x.COM" }];

    await expect(onboardingService.signup(payload({ agents: dupes }))).rejects.toMatchObject({ statusCode: 409 });
    expect(onboardingRepository.signupAgency).not.toHaveBeenCalled();
  });

  it("rejects an agent whose email equals the owner email (409)", async () => {
    await expect(
      onboardingService.signup(payload({ agents: [{ ...bob, email: "ADA@acme.com" }] })),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("drops an empty contact person and keeps a partially filled one", async () => {
    await onboardingService.signup(
      payload({
        agents: [
          { ...bob, contactPerson: { name: " ", phone: "", relationship: "Spouse" } },
          { ...bob, email: "c@x.com", contactPerson: { name: "Cat", phone: "", relationship: "" } },
        ],
      }),
    );

    const arg = vi.mocked(onboardingRepository.signupAgency).mock.calls[0][0];
    expect(arg.agents[0].profile).toMatchObject({ emergencyContactName: null, emergencyContactRelationship: null });
    expect(arg.agents[1].profile).toMatchObject({ emergencyContactName: "Cat", emergencyContactRelationship: null });
  });
});

describe("onboardingService.signup — robustness", () => {
  it("works when agents and hasHomeworkers are omitted (no schema defaults applied)", async () => {
    const p = payload() as unknown as Record<string, unknown>;
    delete p.agents;
    delete p.hasHomeworkers;

    await expect(onboardingService.signup(p as never)).resolves.toMatchObject({ orgId: "org1" });
  });

  it("maps a Postgres unique violation (23505) to a 409", async () => {
    vi.mocked(onboardingRepository.signupAgency).mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" }));

    await expect(onboardingService.signup(payload())).rejects.toMatchObject({ statusCode: 409 });
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
    await onboardingService.signup(payload({ ownerName: '<script>alert(1)</script>' }));

    const sent = providerSend.mock.calls[0][0] as { html: string; subject: string };
    expect(sent.html).not.toContain("<script>");
    expect(sent.html).toContain("&lt;script&gt;");
    expect(sent.subject).toContain("Travana");
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

  it("does not create a shared Homeworkers branch when hasHomeworkers is set", async () => {
    await onboardingService.signup(payload({ hasHomeworkers: true, homeworkerCommission: 50 }));

    const arg = vi.mocked(onboardingRepository.signupAgency).mock.calls[0][0];
    expect(arg.branchInputs).toHaveLength(1); // only the real shop branch
    expect(arg.branchInputs.every((b) => b.branchType === "shop")).toBe(true);
    expect(arg.organization).toMatchObject({ homeworkerCommission: 50 }); // org default kept
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
