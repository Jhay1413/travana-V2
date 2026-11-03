import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./neon-client.service", () => ({
  neonClientService: { getPortalPinStatus: vi.fn(), setPortalPin: vi.fn(), removePortalPin: vi.fn() },
}));

import { neonClientController } from "./neon-client.controller";
import { neonClientService } from "./neon-client.service";

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const req = (body?: object) =>
  ({ params: { id: "c1" }, body, orgId: "org1", orgRole: "agent", orgRoles: ["agent"], branchId: null, user: { id: "u1" } }) as unknown as Request;

beforeEach(() => vi.clearAllMocks());

describe("portal PIN controller", () => {
  it("GET returns {hasPin, mustChangePin} in the success envelope", async () => {
    vi.mocked(neonClientService.getPortalPinStatus).mockResolvedValue({ hasPin: true, mustChangePin: false });
    const res = mockRes();
    await neonClientController.getPortalPin(req(), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { hasPin: true, mustChangePin: false } }));
  });

  it("PUT passes the pin to the service and returns the status", async () => {
    vi.mocked(neonClientService.setPortalPin).mockResolvedValue({ hasPin: true, mustChangePin: false });
    const res = mockRes();
    await neonClientController.setPortalPin(req({ pin: "1234" }), res as unknown as Response, vi.fn());
    expect(vi.mocked(neonClientService.setPortalPin).mock.calls[0].slice(0, 2)).toEqual(["c1", "1234"]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { hasPin: true, mustChangePin: false } }));
  });

  it("DELETE answers 204 with no body", async () => {
    vi.mocked(neonClientService.removePortalPin).mockResolvedValue();
    const res = mockRes();
    await neonClientController.removePortalPin(req(), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
