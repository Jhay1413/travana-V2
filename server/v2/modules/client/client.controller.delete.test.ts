import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { AppError } from "../../utils/error-handler";

vi.mock("./client.service", () => ({ clientService: { deleteClient: vi.fn() } }));

import { clientController } from "./client.controller";
import { clientService } from "./client.service";

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const req = () =>
  ({ params: { id: "c1" }, orgId: "org1", orgRole: "org_admin", orgRoles: ["org_admin"], branchId: null, user: { id: "u1" } }) as unknown as Request;

beforeEach(() => vi.clearAllMocks());

describe("DELETE /clients/:id controller", () => {
  it("returns 200 with the deleted id", async () => {
    vi.mocked(clientService.deleteClient).mockResolvedValue();
    const res = mockRes();
    await clientController.deleteClient(req(), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { id: "c1" } }));
  });

  it("forwards a cross-org 404 to the error middleware", async () => {
    const err = new AppError("Client not found", 404);
    vi.mocked(clientService.deleteClient).mockRejectedValue(err);
    const next = vi.fn();
    await clientController.deleteClient(req(), mockRes() as unknown as Response, next);
    await new Promise((r) => setTimeout(r, 0));
    expect(next).toHaveBeenCalledWith(err);
  });
});
