import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./contact-link.service", () => ({
  contactLinkService: { getStatus: vi.fn(), link: vi.fn(), createAndLink: vi.fn() },
}));

import { contactLinkController } from "./contact-link.controller";
import { contactLinkService } from "./contact-link.service";

const ROW = { id: "c1", firstName: "A", portalPin: "$2a$10$hash" };
function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const req = { params: { contactId: "k1" }, query: {}, body: { clientId: "c1" }, orgId: "o", orgRole: "agent", orgRoles: ["agent"], user: { id: "u" } } as unknown as Request;

beforeEach(() => vi.clearAllMocks());

describe("contact-link responses never contain portalPin", () => {
  it("status (linked client and suggestions)", async () => {
    vi.mocked(contactLinkService.getStatus).mockResolvedValue({ contactId: "k1", linkedClient: ROW, suggestions: [ROW], suggestionMatch: "contact" } as never);
    const res = mockRes();
    await contactLinkController.getStatus(req, res as unknown as Response, vi.fn());
    const body = JSON.stringify(res.json.mock.calls[0][0]);
    expect(body).not.toContain("portalPin");
    expect(body).toContain("\"firstName\":\"A\"");
  });

  it("link and createAndLink", async () => {
    vi.mocked(contactLinkService.link).mockResolvedValue(ROW as never);
    vi.mocked(contactLinkService.createAndLink).mockResolvedValue(ROW as never);
    for (const handler of [contactLinkController.link, contactLinkController.createAndLink]) {
      const res = mockRes();
      await handler(req, res as unknown as Response, vi.fn());
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("portalPin");
    }
  });
});
