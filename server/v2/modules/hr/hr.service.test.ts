import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
vi.mock("../../config/s3", () => ({ s3Client: {}, S3_BUCKET: "bucket" }));
vi.mock("./hr.repository", () => ({ hrRepository: {} }));
vi.mock("../invite/invite.service", () => ({ inviteService: { send: vi.fn() } }));
vi.mock("../homeworker/homeworker.service", () => ({ homeworkerService: { invite: vi.fn() } }));

import { hrService } from "./hr.service";
import { inviteService } from "../invite/invite.service";
import { homeworkerService } from "../homeworker/homeworker.service";

const ADMIN_SCOPE = {
  orgId: "o1",
  branchId: null,
  orgRole: "org_admin",
  orgRoles: ["org_admin"],
  userId: "admin1",
  branchType: null,
  ownsHomeworkerBranch: false,
} as never;

const MANAGER_SCOPE = {
  orgId: "o1",
  branchId: "b1",
  orgRole: "branch_manager",
  orgRoles: ["branch_manager"],
  userId: "m1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hrService.invite", () => {
  it("routes a homeworker through the homeworker service (no invite.service, no branchId)", async () => {
    vi.mocked(homeworkerService.invite).mockResolvedValue({ userId: "u1", branchId: "hb1", email: "a@b.com", expiresAt: new Date(0) });

    const result = await hrService.invite(
      { email: "a@b.com", orgRole: "homeworker", profitSharePercent: "40", displayName: "Jo" },
      ADMIN_SCOPE,
    );

    expect(homeworkerService.invite).toHaveBeenCalledWith(
      { email: "a@b.com", profitSharePercent: "40", displayName: "Jo" },
      { orgId: "o1", userId: "admin1", orgRole: "org_admin", orgRoles: ["org_admin"] },
      undefined,
    );
    expect(inviteService.send).not.toHaveBeenCalled();
    expect(result).toMatchObject({ branchId: "hb1" });
  });

  it("hands the branch manager identity to the homeworker service so it can 403", async () => {
    vi.mocked(homeworkerService.invite).mockRejectedValue(Object.assign(new Error("no"), { statusCode: 403 }));

    await expect(hrService.invite({ email: "a@b.com", orgRole: "homeworker" }, MANAGER_SCOPE)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(vi.mocked(homeworkerService.invite).mock.calls[0][1]).toMatchObject({ orgRole: "branch_manager" });
  });

  it("keeps delegating branch roles to invite.service", async () => {
    vi.mocked(inviteService.send).mockResolvedValue({ userId: "u1" } as never);

    await hrService.invite({ email: "a@b.com", orgRole: "agent", branchId: "b1" }, MANAGER_SCOPE);

    expect(inviteService.send).toHaveBeenCalledWith(
      { email: "a@b.com", branchId: "b1", orgRole: "agent" },
      { orgId: "o1", userId: "m1", orgRole: "branch_manager", branchId: "b1" },
      undefined,
    );
    expect(homeworkerService.invite).not.toHaveBeenCalled();
  });

  it("still blocks a branch manager inviting into another branch", async () => {
    await expect(
      hrService.invite({ email: "a@b.com", orgRole: "agent", branchId: "b2" }, MANAGER_SCOPE),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(inviteService.send).not.toHaveBeenCalled();
  });
});

describe("hrService.invite - link origin", () => {
  it("passes the request origin to both invite arms", async () => {
    vi.mocked(homeworkerService.invite).mockResolvedValue({} as never);
    vi.mocked(inviteService.send).mockResolvedValue({} as never);
    await hrService.invite({ email: "a@b.com", orgRole: "homeworker" }, MANAGER_SCOPE, "http://localhost:5000");
    await hrService.invite({ email: "a@b.com", orgRole: "agent", branchId: "b1" }, MANAGER_SCOPE, "http://localhost:5000");
    expect(vi.mocked(homeworkerService.invite).mock.calls.at(-1)?.[2]).toBe("http://localhost:5000");
    expect(vi.mocked(inviteService.send).mock.calls.at(-1)?.[2]).toBe("http://localhost:5000");
  });
});
