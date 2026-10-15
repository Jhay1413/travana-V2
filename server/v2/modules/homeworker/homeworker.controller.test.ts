import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./homeworker.service", () => ({
  homeworkerService: {
    invite: vi.fn(),
    list: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    getStatement: vi.fn(),
    getMyStatement: vi.fn(),
    finaliseStatement: vi.fn(),
  },
}));

import { homeworkerController } from "./homeworker.controller";
import { homeworkerService } from "./homeworker.service";
import { AppError } from "../../utils/error-handler";

function req(over: Record<string, unknown> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    orgId: "o1",
    branchId: null,
    orgRole: "org_admin",
    orgRoles: ["org_admin"],
    user: { authType: "password", userId: "admin1" },
    ...over,
  } as never;
}

function mockRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("homeworkerController", () => {
  it("invite returns 201 and passes the actor context", async () => {
    vi.mocked(homeworkerService.invite).mockResolvedValue({ userId: "u1", branchId: "b1", email: "a@b.com", expiresAt: new Date(0) });
    const res = mockRes();

    await homeworkerController.invite(req({ body: { email: "a@b.com" } }), res as never, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(homeworkerService.invite).toHaveBeenCalledWith(
      { email: "a@b.com" },
      { orgId: "o1", userId: "admin1", orgRole: "org_admin", orgRoles: ["org_admin"] },
    );
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: { branchId: "b1" } });
  });

  it("invite 403s without an organisation context (platform admin not impersonating)", async () => {
    const next = vi.fn();

    await homeworkerController.invite(req({ orgId: "" }), mockRes() as never, next);
    await flush();

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    expect(homeworkerService.invite).not.toHaveBeenCalled();
  });

  it("list returns 200 and parses includeArchived", async () => {
    vi.mocked(homeworkerService.list).mockResolvedValue([]);
    const res = mockRes();

    await homeworkerController.list(req({ query: { includeArchived: "true" } }), res as never, vi.fn());
    expect(homeworkerService.list).toHaveBeenLastCalledWith("o1", true);

    await homeworkerController.list(req(), res as never, vi.fn());
    expect(homeworkerService.list).toHaveBeenLastCalledWith("o1", false);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("me returns the caller's branch and forwards a service 404", async () => {
    vi.mocked(homeworkerService.getMine).mockResolvedValueOnce({ branchId: "b1", name: "Jo", profitSharePercent: "40", isActive: true });
    const res = mockRes();
    await homeworkerController.me(req({ orgRole: "homeworker", orgRoles: ["homeworker"], user: { authType: "password", userId: "hw1" } }), res as never, vi.fn());
    expect(homeworkerService.getMine).toHaveBeenCalledWith("o1", "hw1");
    expect(res.status).toHaveBeenCalledWith(200);

    vi.mocked(homeworkerService.getMine).mockRejectedValueOnce(new AppError("Homeworker branch not found", 404));
    const next = vi.fn();
    await homeworkerController.me(req(), mockRes() as never, next);
    await flush();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
  });

  it("update returns 200 and forwards branchId and body", async () => {
    vi.mocked(homeworkerService.update).mockResolvedValue({ id: "b1" } as never);
    const res = mockRes();

    await homeworkerController.update(req({ params: { branchId: "b1" }, body: { name: "X" } }), res as never, vi.fn());

    expect(homeworkerService.update).toHaveBeenCalledWith("b1", "o1", { name: "X" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("archive returns 200, and forwards a 409 from the service", async () => {
    vi.mocked(homeworkerService.archive).mockResolvedValueOnce({ id: "b1" } as never);
    const res = mockRes();
    await homeworkerController.archive(req({ params: { branchId: "b1" } }), res as never, vi.fn());
    expect(homeworkerService.archive).toHaveBeenCalledWith("b1", "o1");
    expect(res.status).toHaveBeenCalledWith(200);

    vi.mocked(homeworkerService.archive).mockRejectedValueOnce(new AppError("Homeworker is already archived", 409));
    const next = vi.fn();
    await homeworkerController.archive(req({ params: { branchId: "b1" } }), mockRes() as never, next);
    await flush();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
  });
});

describe("homeworkerController statements", () => {
  it("statement returns 200 and forwards branch id and period", async () => {
    vi.mocked(homeworkerService.getStatement).mockResolvedValue({ gross: "1.00" } as never);
    const res = mockRes();

    await homeworkerController.statement(
      req({ params: { branchId: "b1" }, query: { from: "2026-03-01", to: "2026-04-01" } }),
      res as never,
      vi.fn(),
    );

    expect(homeworkerService.getStatement).toHaveBeenCalledWith(
      { orgId: "o1", userId: "admin1", orgRole: "org_admin", orgRoles: ["org_admin"] },
      "b1",
      "2026-03-01",
      "2026-04-01",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("myStatement returns 200 for the caller and forwards a 404", async () => {
    vi.mocked(homeworkerService.getMyStatement).mockResolvedValueOnce({ gross: "1.00" } as never);
    const res = mockRes();
    await homeworkerController.myStatement(req({ orgRole: "homeworker", orgRoles: ["homeworker"] }), res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);

    vi.mocked(homeworkerService.getMyStatement).mockRejectedValueOnce(new AppError("Homeworker branch not found", 404));
    const next = vi.fn();
    await homeworkerController.myStatement(req(), mockRes() as never, next);
    await flush();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
  });

  it("finaliseStatement returns 201 and forwards a 409", async () => {
    vi.mocked(homeworkerService.finaliseStatement).mockResolvedValueOnce({ id: "st1" } as never);
    const res = mockRes();
    await homeworkerController.finaliseStatement(
      req({ params: { branchId: "b1" }, body: { from: "2026-03-01", to: "2026-04-01" } }),
      res as never,
      vi.fn(),
    );
    expect(homeworkerService.finaliseStatement).toHaveBeenCalledWith(expect.anything(), "b1", "2026-03-01", "2026-04-01");
    expect(res.status).toHaveBeenCalledWith(201);

    vi.mocked(homeworkerService.finaliseStatement).mockRejectedValueOnce(new AppError("exists", 409));
    const next = vi.fn();
    await homeworkerController.finaliseStatement(req({ params: { branchId: "b1" }, body: {} }), mockRes() as never, next);
    await flush();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
  });
});
