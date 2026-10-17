import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./note.repository", () => ({
  noteRepository: {
    findByTransactionId: vi.fn(),
    findByClientId: vi.fn(),
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    transactionBelongsToOrg: vi.fn(),
    clientBelongsToOrg: vi.fn(),
  },
}));

import { noteService } from "./note.service";
import { noteRepository } from "./note.repository";
import type { Scope } from "../../utils/scope";

const SHOP_AGENT: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

const OWN_HOMEWORKER: Scope = {
  ...SHOP_AGENT,
  orgRole: "homeworker",
  orgRoles: ["homeworker"],
  branchId: "hw1",
  userId: "hw",
  branchType: "homeworker",
  ownsHomeworkerBranch: true,
};

beforeEach(() => vi.clearAllMocks());

describe("noteService partition", () => {
  it("shop agent cannot list notes on a homeworker's transaction", async () => {
    vi.mocked(noteRepository.transactionBelongsToOrg).mockResolvedValue(false);
    await expect(noteService.listByTransactionId("t1", SHOP_AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(noteRepository.transactionBelongsToOrg).toHaveBeenCalledWith("t1", "org1", SHOP_AGENT);
    expect(noteRepository.findByTransactionId).not.toHaveBeenCalled();
  });

  it("shop agent cannot list notes on a homeworker's client", async () => {
    vi.mocked(noteRepository.clientBelongsToOrg).mockResolvedValue(false);
    await expect(noteService.listByClientId("c1", SHOP_AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(noteRepository.clientBelongsToOrg).toHaveBeenCalledWith("c1", "org1", SHOP_AGENT);
    expect(noteRepository.findByClientId).not.toHaveBeenCalled();
  });

  it("shop agent cannot load a homeworker's transaction note by id", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "org1", transaction_id: "t1", client_id: null });
    vi.mocked(noteRepository.transactionBelongsToOrg).mockResolvedValue(false);
    await expect(noteService.getNote("n1", SHOP_AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(noteRepository.findById).not.toHaveBeenCalled();
  });

  it("shop agent cannot load a homeworker's client note by id", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "org1", transaction_id: null, client_id: "c1" });
    vi.mocked(noteRepository.clientBelongsToOrg).mockResolvedValue(false);
    await expect(noteService.getNote("n1", SHOP_AGENT)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("homeworker in their own branch can load and list their notes", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "org1", transaction_id: "t1", client_id: null });
    vi.mocked(noteRepository.transactionBelongsToOrg).mockResolvedValue(true);
    vi.mocked(noteRepository.findById).mockResolvedValue({ id: "n1" } as never);
    vi.mocked(noteRepository.findByTransactionId).mockResolvedValue([]);

    await expect(noteService.getNote("n1", OWN_HOMEWORKER)).resolves.toEqual({ id: "n1" });
    await expect(noteService.listByTransactionId("t1", OWN_HOMEWORKER)).resolves.toEqual([]);
    expect(noteRepository.transactionBelongsToOrg).toHaveBeenCalledWith("t1", "org1", OWN_HOMEWORKER);
  });

  it("rejects a note from another org without consulting the partition", async () => {
    vi.mocked(noteRepository.findByIdWithOrg).mockResolvedValue({ id: "n1", orgId: "other", transaction_id: "t1", client_id: null });
    await expect(noteService.getNote("n1", SHOP_AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(noteRepository.transactionBelongsToOrg).not.toHaveBeenCalled();
  });

  it("a trusted scope skips every check", async () => {
    vi.mocked(noteRepository.findByTransactionId).mockResolvedValue([]);
    await noteService.listByTransactionId("t1", { orgId: null });
    expect(noteRepository.transactionBelongsToOrg).not.toHaveBeenCalled();
  });
});
