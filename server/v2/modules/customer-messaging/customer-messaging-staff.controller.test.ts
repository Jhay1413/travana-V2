import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./customer-messaging-availability.service", () => ({ customerMessagingAvailabilityService: { getAvailability: vi.fn() } }));
vi.mock("./customer-messaging-log.service", () => ({ customerMessagingLogService: { list: vi.fn() } }));
vi.mock("./customer-messaging-staff-send.service", () => ({ customerMessagingStaffSendService: { send: vi.fn() } }));

import { customerMessagingStaffController as c } from "./customer-messaging-staff.controller";
import { customerMessagingAvailabilityService as availability } from "./customer-messaging-availability.service";
import { customerMessagingLogService as log } from "./customer-messaging-log.service";
import { customerMessagingStaffSendService as sender } from "./customer-messaging-staff-send.service";

function req(over: { query?: Record<string, unknown>; body?: unknown; userId?: string | null } = {}) {
  return {
    query: over.query ?? {},
    body: over.body ?? {},
    params: {},
    orgId: "o1",
    orgRole: "agent",
    orgRoles: ["agent"],
    user: over.userId === null ? undefined : { authType: "password", userId: over.userId ?? "u1" },
  } as never;
}
function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((r) => setImmediate(r));
const envelope = (data: unknown) => ({ success: true, message: expect.any(String), data });
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => vi.clearAllMocks());

describe("customerMessagingStaffController", () => {
  it("GET availability passes the client and purpose with the caller's scope", async () => {
    const data = { defaultChannel: "whatsapp", channels: { whatsapp: { available: true }, sms: { available: true } } };
    vi.mocked(availability.getAvailability).mockResolvedValue(data as never);
    const res = mockRes();
    await c.getAvailability(req({ query: { clientId: ID, purpose: "quote_link" } }), res as never, vi.fn());
    await flush();
    expect(availability.getAvailability).toHaveBeenCalledWith({ clientId: ID, purpose: "quote_link" }, expect.objectContaining({ orgId: "o1", orgRole: "agent" }));
    expect(res.json).toHaveBeenCalledWith(envelope(data));
  });

  it("POST send passes the body and the signed-in user, and returns the result", async () => {
    vi.mocked(sender.send).mockResolvedValue({ status: "sent", channel: "sms" });
    const res = mockRes();
    await c.send(req({ body: { clientId: ID, purpose: "portal_sign_in", channel: "sms" } }), res as never, vi.fn());
    await flush();
    expect(sender.send).toHaveBeenCalledWith({ clientId: ID, purpose: "portal_sign_in", channel: "sms" }, "u1", expect.objectContaining({ orgId: "o1" }));
    expect(res.json).toHaveBeenCalledWith(envelope({ status: "sent", channel: "sms" }));
  });

  it("POST send keeps the quote id", async () => {
    vi.mocked(sender.send).mockResolvedValue({ status: "sent", channel: "whatsapp" });
    await c.send(req({ body: { clientId: ID, purpose: "quote_link", channel: "whatsapp", quoteId: "q1" } }), mockRes() as never, vi.fn());
    await flush();
    expect(vi.mocked(sender.send).mock.calls[0][0]).toEqual({ clientId: ID, purpose: "quote_link", channel: "whatsapp", quoteId: "q1" });
  });

  it("POST send answers 200 with a not-sent result (it is an outcome, not an error)", async () => {
    const result = { status: "not_sent", channel: "sms", reason: "opted_out", message: "Customer opted out." };
    vi.mocked(sender.send).mockResolvedValue(result as never);
    const res = mockRes();
    await c.send(req({ body: { clientId: ID, purpose: "portal_sign_in", channel: "sms" } }), res as never, vi.fn());
    await flush();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(envelope(result));
  });

  it("POST send without a signed-in user is a 401 and sends nothing", async () => {
    const next = vi.fn();
    await c.send(req({ userId: null, body: { clientId: ID, purpose: "portal_sign_in", channel: "sms" } }), mockRes() as never, next);
    await flush();
    expect(sender.send).not.toHaveBeenCalled();
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  });

  it("GET log turns the query strings into a number and a cursor", async () => {
    const page = { items: [], nextCursor: null, unavailable: false };
    vi.mocked(log.list).mockResolvedValue(page);
    const res = mockRes();
    await c.getLog(req({ query: { clientId: ID, limit: "5", cursor: "10" } }), res as never, vi.fn());
    await flush();
    expect(log.list).toHaveBeenCalledWith({ clientId: ID, limit: 5, cursor: "10" }, expect.objectContaining({ orgId: "o1" }));
    expect(res.json).toHaveBeenCalledWith(envelope(page));
  });

  it("GET log with no paging sends only the client id", async () => {
    vi.mocked(log.list).mockResolvedValue({ items: [], nextCursor: null, unavailable: true });
    await c.getLog(req({ query: { clientId: ID } }), mockRes() as never, vi.fn());
    await flush();
    expect(vi.mocked(log.list).mock.calls[0][0]).toEqual({ clientId: ID });
  });

  it("a service error goes to the error middleware", async () => {
    const err = Object.assign(new Error("Client not found"), { statusCode: 404 });
    vi.mocked(log.list).mockRejectedValue(err);
    const next = vi.fn();
    await c.getLog(req({ query: { clientId: ID } }), mockRes() as never, next);
    await flush();
    expect(next).toHaveBeenCalledWith(err);
  });
});
