import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../neon-client/neon-client.service", () => ({ neonClientService: { viewNeonClientById: vi.fn() } }));
vi.mock("./customer-messaging.repository", () => {
  class LogUnavailableError extends Error {}
  return { customerMessagingRepository: { listLogForClient: vi.fn() }, LogUnavailableError };
});

import { customerMessagingLogService as svc, toEntry } from "./customer-messaging-log.service";
import { neonClientService } from "../neon-client/neon-client.service";
import { customerMessagingRepository as repo, LogUnavailableError } from "./customer-messaging.repository";
import { MESSAGE_LOG_ENTRY_KEYS, type MessageLogRow } from "./customer-messaging-staff.types";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

const scope: Scope = { orgId: "o1", branchId: null, orgRole: "agent", orgRoles: ["agent"], userId: "u1", branchType: null, ownsHomeworkerBranch: false };
const row = (over: Partial<MessageLogRow> = {}): MessageLogRow => ({
  id: "r1",
  purpose: "booking_confirmation",
  channel: "whatsapp",
  status: "sent",
  reason: null,
  templateName: "booking_tpl",
  triggerSource: "booking.created",
  triggeredByName: null,
  createdAt: new Date("2030-11-24T14:02:00Z"),
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(neonClientService.viewNeonClientById).mockResolvedValue({ id: "c1" } as never);
});

describe("toEntry: only the documented keys leave the server", () => {
  it("has exactly the agreed key set", () => {
    expect(Object.keys(toEntry(row())).sort()).toEqual([...MESSAGE_LOG_ENTRY_KEYS].sort());
  });
  it("drops anything extra the row might carry (body, phone, link, provider id, dedupe key)", () => {
    const leaky = { ...row(), body: "secret text", toPhone: "+447700900123", link: "https://x?mt=ABC", providerMessageId: "sid", dedupeKey: "k", orgId: "o1", clientId: "c1" };
    const out = toEntry(leaky as MessageLogRow) as unknown as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual([...MESSAGE_LOG_ENTRY_KEYS].sort());
    expect(JSON.stringify(out)).not.toMatch(/secret text|447700900123|mt=ABC|sid/);
  });
  it("turns a stored reason code into plain text, and shows none for a sent message", () => {
    expect(toEntry(row({ status: "skipped", reason: "opted_out" })).reason).toBe("customer opted out");
    expect(toEntry(row({ status: "skipped", reason: "something_new" })).reason).toBe("Not sent");
    expect(toEntry(row({ status: "sent", reason: "opted_out" })).reason).toBeNull();
    expect(toEntry(row({ status: "skipped", reason: null })).reason).toBeNull();
  });
  it("gives the time as an ISO string", () => {
    expect(toEntry(row()).createdAt).toBe("2030-11-24T14:02:00.000Z");
  });
});

describe("list", () => {
  it("reads only this agency's rows for this client, after the client page's own access check", async () => {
    vi.mocked(repo.listLogForClient).mockResolvedValue([row()]);
    const page = await svc.list({ clientId: "c1" }, scope);
    expect(neonClientService.viewNeonClientById).toHaveBeenCalledWith("c1", scope);
    expect(repo.listLogForClient).toHaveBeenCalledWith({ orgId: "o1", clientId: "c1", limit: 21, offset: 0 });
    expect(page).toEqual({ items: [toEntry(row())], nextCursor: null, unavailable: false });
  });
  it("another agency's client is a 404 and the log is never read", async () => {
    vi.mocked(neonClientService.viewNeonClientById).mockRejectedValue(new AppError("Client not found", 404));
    await expect(svc.list({ clientId: "c1" }, scope)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.listLogForClient).not.toHaveBeenCalled();
  });
  it("pages: asks for one extra row to know whether there is more, and hands back a cursor", async () => {
    vi.mocked(repo.listLogForClient).mockResolvedValue([row({ id: "a" }), row({ id: "b" }), row({ id: "c" })]);
    const page = await svc.list({ clientId: "c1", limit: 2 }, scope);
    expect(page.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("2");
    vi.mocked(repo.listLogForClient).mockResolvedValue([row({ id: "c" })]);
    const next = await svc.list({ clientId: "c1", limit: 2, cursor: "2" }, scope);
    expect(repo.listLogForClient).toHaveBeenLastCalledWith({ orgId: "o1", clientId: "c1", limit: 3, offset: 2 });
    expect(next.nextCursor).toBeNull();
  });
  it("clamps the page size", async () => {
    vi.mocked(repo.listLogForClient).mockResolvedValue([]);
    await svc.list({ clientId: "c1", limit: 5000 }, scope);
    expect(repo.listLogForClient).toHaveBeenCalledWith(expect.objectContaining({ limit: 51 }));
  });
  it("a missing log table is an empty list flagged unavailable, not an error", async () => {
    vi.mocked(repo.listLogForClient).mockRejectedValue(new LogUnavailableError());
    expect(await svc.list({ clientId: "c1" }, scope)).toEqual({ items: [], nextCursor: null, unavailable: true });
  });
  it("any other database error still fails", async () => {
    vi.mocked(repo.listLogForClient).mockRejectedValue(new Error("db down"));
    await expect(svc.list({ clientId: "c1" }, scope)).rejects.toThrow("db down");
  });
  it("needs an organisation in scope", async () => {
    await expect(svc.list({ clientId: "c1" }, { ...scope, orgId: "" })).rejects.toMatchObject({ statusCode: 400 });
  });
});
