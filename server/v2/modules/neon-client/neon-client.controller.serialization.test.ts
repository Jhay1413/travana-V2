import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./neon-client.service", () => ({
  neonClientService: {
    listNeonClientsPaginated: vi.fn(),
    getNeonClientById: vi.fn(),
    createNeonClient: vi.fn(),
    updateNeonClient: vi.fn(),
    mergeClients: vi.fn(),
    getDuplicatePhoneGroup: vi.fn(),
    mergeDuplicatesInto: vi.fn(),
  },
}));

import { neonClientController } from "./neon-client.controller";
import { neonClientService } from "./neon-client.service";

const ROW = { id: "c1", firstName: "A", portalPin: "$2a$10$hash", mustChangePin: false };

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const req = { params: { id: "c1", phoneKey: "123456789" }, query: {}, body: { targetId: "c2", sourceIds: ["c2"] }, orgId: "o", orgRole: "agent", orgRoles: ["agent"], user: { id: "u" } } as unknown as Request;
const sent = (res: ReturnType<typeof mockRes>) => JSON.stringify(res.json.mock.calls[0][0]);

beforeEach(() => vi.clearAllMocks());

describe("neon-client responses never contain portalPin", () => {
  const cases: Array<[string, () => void, keyof typeof neonClientController]> = [
    ["list", () => vi.mocked(neonClientService.listNeonClientsPaginated).mockResolvedValue({ clients: [ROW], total: 1, page: 1, limit: 10, totalPages: 1 } as never), "listNeonClients"],
    ["get", () => vi.mocked(neonClientService.getNeonClientById).mockResolvedValue(ROW as never), "getNeonClientById"],
    ["create", () => vi.mocked(neonClientService.createNeonClient).mockResolvedValue(ROW as never), "createNeonClient"],
    ["update", () => vi.mocked(neonClientService.updateNeonClient).mockResolvedValue(ROW as never), "updateNeonClient"],
    ["merge", () => vi.mocked(neonClientService.mergeClients).mockResolvedValue(ROW as never), "mergeNeonClient"],
    ["duplicate group", () => vi.mocked(neonClientService.getDuplicatePhoneGroup).mockResolvedValue({ phoneKey: "x", clients: [ROW] } as never), "getDuplicatePhoneGroup"],
    ["merge duplicates", () => vi.mocked(neonClientService.mergeDuplicatesInto).mockResolvedValue({ target: ROW, mergedIds: ["c2"], failed: [] } as never), "mergeDuplicateGroup"],
  ];

  it.each(cases)("%s", async (_name, arrange, handler) => {
    arrange();
    const res = mockRes();
    await neonClientController[handler](req, res as unknown as Response, vi.fn());
    const body = sent(res);
    expect(body).not.toContain("portalPin");
    expect(body).not.toContain("$2a$10$hash");
    expect(body).toContain("\"firstName\":\"A\"");
  });
});

describe("public client columns (used by transaction details)", () => {
  it("excludes portalPin but keeps ordinary columns", async () => {
    const { publicClientColumns } = await import("./neon-client.serializer");
    expect(publicClientColumns).not.toHaveProperty("portalPin");
    expect(publicClientColumns).toHaveProperty("firstName");
    expect(publicClientColumns).toHaveProperty("mustChangePin");
  });
});
