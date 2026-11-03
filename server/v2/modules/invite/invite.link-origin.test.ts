import { describe, it, expect, vi, beforeEach } from "vitest";

const providerSend = vi.hoisted(() => vi.fn());
vi.mock("./invite.repository", () => ({
  inviteRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findBranchMembershipForUser: vi.fn(),
    getOrgName: vi.fn(),
    createPendingUserWithBranchMembership: vi.fn(),
    updateUser: vi.fn(),
  },
}));
vi.mock("../homeworker/homeworker.service", () => ({ homeworkerService: { invite: vi.fn() } }));
vi.mock("../organization/organization-seat.service", () => ({
  organizationSeatService: { assertSeatAvailable: vi.fn() },
}));
vi.mock("../organization/organization-audit.service", () => ({
  organizationAuditService: { record: vi.fn() },
}));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.travana.co.uk" }));
vi.mock("../../../services/email-provider", () => ({ getEmailProvider: () => ({ send: providerSend }) }));

import { inviteService } from "./invite.service";
import { inviteRepository } from "./invite.repository";
import { branchRepository } from "../branch/branch.repository";
import { homeworkerService } from "../homeworker/homeworker.service";

const ADMIN = { orgId: "o1", userId: "a1", orgRole: "org_admin", branchId: null };
const LOCAL = "http://localhost:5000";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REPLIT_DEPLOYMENT;
  delete process.env.REPLIT_DEPLOYMENT_ID;
  vi.mocked(inviteRepository.getOrgName).mockResolvedValue("Org");
});

describe("invite emails use the request origin outside production", () => {
  it("send", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(inviteRepository.findByEmail).mockResolvedValue(null as never);
    vi.mocked(inviteRepository.createPendingUserWithBranchMembership).mockResolvedValue({ id: "u1" } as never);

    await inviteService.send({ email: "x@y.com", branchId: "b1", orgRole: "agent" }, ADMIN, LOCAL);

    expect(providerSend.mock.calls[0][0].text).toContain(`${LOCAL}/accept-invite?token=`);
  });

  it("send without an origin falls back to the configured URL", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(inviteRepository.findByEmail).mockResolvedValue(null as never);
    vi.mocked(inviteRepository.createPendingUserWithBranchMembership).mockResolvedValue({ id: "u1" } as never);

    await inviteService.send({ email: "x@y.com", branchId: "b1", orgRole: "agent" }, ADMIN);

    expect(providerSend.mock.calls[0][0].text).toContain("https://app.travana.co.uk/accept-invite?token=");
  });

  it("resend", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u1", orgId: "o1", email: "x@y.com", inviteToken: "old" } as never);

    await inviteService.resend("u1", ADMIN, LOCAL);

    expect(providerSend.mock.calls[0][0].text).toContain(`${LOCAL}/accept-invite?token=`);
  });

  it("passes the origin on to the homeworker arm", async () => {
    await inviteService.send({ email: "x@y.com", orgRole: "homeworker" }, ADMIN, LOCAL);
    expect(vi.mocked(homeworkerService.invite).mock.calls[0][2]).toBe(LOCAL);
  });
});
