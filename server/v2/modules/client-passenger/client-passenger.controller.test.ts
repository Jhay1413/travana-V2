import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./client-passenger.service", () => ({
  clientPassengerService: { list: vi.fn(), setLeadPassport: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

import { clientPassengerController } from "./client-passenger.controller";
import { clientPassengerService } from "./client-passenger.service";

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const req = (body?: object, extra: Record<string, string> = {}) =>
  ({ params: { clientId: "c1", ...extra }, body, orgId: "org1", orgRole: "agent", orgRoles: ["agent"], branchId: null, user: { id: "u1" } }) as unknown as Request;

const PASSENGER = {
  id: "p1", isLead: false, title: null, firstName: "A", surname: "B",
  dateOfBirth: null, passportNumber: null, passportExpiry: null, passportWarning: false,
};

beforeEach(() => vi.clearAllMocks());

describe("client passenger controller", () => {
  it("GET answers 200 with the response in the envelope", async () => {
    const data = { passengers: [PASSENGER], nextDeparture: null };
    vi.mocked(clientPassengerService.list).mockResolvedValue(data);
    const res = mockRes();
    await clientPassengerController.list(req(), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data }));
    expect(vi.mocked(clientPassengerService.list).mock.calls[0]![0]).toBe("c1");
  });

  it("PUT lead answers 200 with the lead", async () => {
    vi.mocked(clientPassengerService.setLeadPassport).mockResolvedValue({ ...PASSENGER, isLead: true });
    const res = mockRes();
    await clientPassengerController.setLead(req({ passportNumber: "1", passportExpiry: null }), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(vi.mocked(clientPassengerService.setLeadPassport).mock.calls[0]!.slice(0, 2)).toEqual(["c1", { passportNumber: "1", passportExpiry: null }]);
  });

  it("POST answers 201", async () => {
    vi.mocked(clientPassengerService.create).mockResolvedValue(PASSENGER);
    const res = mockRes();
    await clientPassengerController.create(
      req({ title: "Mr", firstName: "A", surname: "B", dateOfBirth: "2000-01-31", passportNumber: "123456789", passportExpiry: "2030-05-01" }),
      res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: PASSENGER }));
  });

  it("PATCH passes both ids and answers 200", async () => {
    vi.mocked(clientPassengerService.update).mockResolvedValue(PASSENGER);
    const res = mockRes();
    await clientPassengerController.update(req({ firstName: "Z" }, { passengerId: "p1" }), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(vi.mocked(clientPassengerService.update).mock.calls[0]!.slice(0, 3)).toEqual(["c1", "p1", { firstName: "Z" }]);
  });

  it("DELETE answers 204 with no body", async () => {
    vi.mocked(clientPassengerService.remove).mockResolvedValue();
    const res = mockRes();
    await clientPassengerController.remove(req(undefined, { passengerId: "p1" }), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
