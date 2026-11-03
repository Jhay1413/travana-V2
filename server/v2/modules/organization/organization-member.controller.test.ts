import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./organization-member.service", () => ({
  orgMemberService: {
    list: vi.fn(), updateRole: vi.fn(), setSuspended: vi.fn(), assignToBranch: vi.fn(),
    unassignFromBranch: vi.fn(), updateProfile: vi.fn(),
  },
}));
vi.mock("./organization-member-removal.service", () => ({
  organizationMemberRemovalService: { getWorkload: vi.fn(), remove: vi.fn() },
}));
vi.mock("./organization-seat.service", () => ({ organizationSeatService: { getUsage: vi.fn() } }));

import { orgMemberController } from "./organization-member.controller";
import { orgMemberService } from "./organization-member.service";
import { organizationMemberRemovalService } from "./organization-member-removal.service";
import { organizationSeatService } from "./organization-seat.service";

const ACTOR = { userId: "admin1", ipAddress: "1.2.3.4", userAgent: "ua", impersonating: false };

function req(over: Record<string, unknown> = {}) {
  return {
    params: { userId: "u2" },
    body: {},
    ip: "1.2.3.4",
    headers: { "x-forwarded-for": "6.6.6.6", "user-agent": "ua" },
    socket: { remoteAddress: "10.0.0.1" },
    session: {},
    orgId: "o1",
    user: { authType: "password", userId: "admin1" },
    ...over,
  } as never;
}

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => vi.clearAllMocks());

describe("orgMemberController HTTP contract", () => {
  it("403s without an organisation context", async () => {
    const next = vi.fn();
    await orgMemberController.list(req({ orgId: "" }), mockRes() as never, next);
    await flush();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it("seats returns the usage envelope", async () => {
    const usage = { limit: 10, activeMembers: 6, pendingInvites: 2, used: 8, available: 2 };
    vi.mocked(organizationSeatService.getUsage).mockResolvedValue(usage);
    const res = mockRes();
    await orgMemberController.seats(req(), res as never, vi.fn());
    await flush();
    expect(organizationSeatService.getUsage).toHaveBeenCalledWith("o1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: usage });
  });

  it("updateRole passes the role and the request actor (ip from req.ip, not the spoofable header)", async () => {
    vi.mocked(orgMemberService.updateRole).mockResolvedValue({ userId: "u2", orgRole: "agent" });
    const res = mockRes();
    await orgMemberController.updateRole(req({ body: { orgRole: "agent" } }), res as never, vi.fn());
    await flush();
    expect(orgMemberService.updateRole).toHaveBeenCalledWith("o1", "u2", "agent", ACTOR);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("setSuspended forwards notify only when suspending", async () => {
    vi.mocked(orgMemberService.setSuspended).mockResolvedValue({ userId: "u2", suspended: true });
    await orgMemberController.setSuspended(req({ body: { suspended: true, notify: true } }), mockRes() as never, vi.fn());
    await flush();
    expect(orgMemberService.setSuspended).toHaveBeenLastCalledWith("o1", "u2", true, ACTOR, true);

    await orgMemberController.setSuspended(req({ body: { suspended: false, notify: true } }), mockRes() as never, vi.fn());
    await flush();
    expect(orgMemberService.setSuspended).toHaveBeenLastCalledWith("o1", "u2", false, ACTOR, false);
  });

  it("assignBranch answers 201", async () => {
    vi.mocked(orgMemberService.assignToBranch).mockResolvedValue({ id: "bm1" } as never);
    const res = mockRes();
    await orgMemberController.assignBranch(req({ body: { branchId: "b1", orgRole: "agent" } }), res as never, vi.fn());
    await flush();
    expect(orgMemberService.assignToBranch).toHaveBeenCalledWith("o1", "u2", "b1", "agent", ACTOR);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("updateProfile forwards only the three profile fields", async () => {
    vi.mocked(orgMemberService.updateProfile).mockResolvedValue({
      userId: "u2", firstName: "Ada", lastName: "L", phoneNumber: "", name: "Ada L",
    });
    await orgMemberController.updateProfile(
      req({ body: { firstName: "Ada", phoneNumber: "", email: "evil@x.com", orgRole: "org_admin" } }),
      mockRes() as never, vi.fn(),
    );
    await flush();
    expect(orgMemberService.updateProfile).toHaveBeenCalledWith("o1", "u2", { firstName: "Ada", phoneNumber: "" }, ACTOR);
  });

  it("workload returns the counts", async () => {
    const counts = { openDeals: 1, openTasks: 2, openTickets: 3, clients: 4 };
    vi.mocked(organizationMemberRemovalService.getWorkload).mockResolvedValue(counts);
    const res = mockRes();
    await orgMemberController.workload(req(), res as never, vi.fn());
    await flush();
    expect(organizationMemberRemovalService.getWorkload).toHaveBeenCalledWith("o1", "u2");
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: counts });
  });

  it("remove passes newOwnerId and the actor, never the confirm word", async () => {
    vi.mocked(organizationMemberRemovalService.remove).mockResolvedValue({
      userId: "u2", moved: { openDeals: 0, openTasks: 0, openTickets: 0, clients: 0 },
    });
    const res = mockRes();
    await orgMemberController.remove(req({ body: { newOwnerId: "u3", confirm: "REMOVE" } }), res as never, vi.fn());
    await flush();
    expect(organizationMemberRemovalService.remove).toHaveBeenCalledWith("o1", "u2", { newOwnerId: "u3" }, ACTOR);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("401s when there is no signed-in user", async () => {
    const next = vi.fn();
    await orgMemberController.updateRole(req({ user: undefined, body: { orgRole: "agent" } }), mockRes() as never, next);
    await flush();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });
});
