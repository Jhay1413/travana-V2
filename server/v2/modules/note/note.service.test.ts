import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./note.repository", () => ({
  noteRepository: {
    findByTransactionId: vi.fn(),
    findByClientId: vi.fn(),
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    transactionBelongsToOrg: vi.fn(),
    clientBelongsToOrg: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

describe("noteService content sanitising", () => {
  const TRUSTED = { orgId: null } as const;
  const createdContent = () => vi.mocked(noteRepository.create).mock.calls[0][0].content;

  it("strips XSS on create (including replies)", async () => {
    vi.mocked(noteRepository.create).mockResolvedValue({} as never);
    await noteService.createNote(
      { transaction_id: "t1", parent_id: "p1", content: '<p>hi</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>' },
      TRUSTED,
    );
    const c = createdContent() ?? "";
    expect(c).not.toMatch(/script|onerror|javascript:|<img/i);
    expect(c).toContain("<p>hi</p>");
  });

  it("keeps benign formatting on create", async () => {
    vi.mocked(noteRepository.create).mockResolvedValue({} as never);
    await noteService.createNote({ transaction_id: "t1", content: '<p><strong>b</strong> <em>i</em></p><ul><li>one</li></ul><a href="https://x.com">l</a>' }, TRUSTED);
    const c = createdContent() ?? "";
    expect(c).toContain("<strong>b</strong>");
    expect(c).toContain("<em>i</em>");
    expect(c).toContain("<ul><li>one</li></ul>");
    expect(c).toContain('href="https://x.com"');
  });

  it("escapes a bare < in plain text and leaves null content alone", async () => {
    vi.mocked(noteRepository.create).mockResolvedValue({} as never);
    await noteService.createNote({ transaction_id: "t1", content: "a < b" }, TRUSTED);
    expect(createdContent()).toBe("a &lt; b");
    vi.mocked(noteRepository.create).mockClear();
    await noteService.createNote({ transaction_id: "t1", content: null }, TRUSTED);
    expect(createdContent()).toBeNull();
  });

  it("sanitises on update", async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue({ id: "n1" } as never);
    vi.mocked(noteRepository.update).mockResolvedValue({ id: "n1" } as never);
    await noteService.updateNote("n1", "<b>ok</b><script>x</script><iframe src=y></iframe>", TRUSTED);
    expect(noteRepository.update).toHaveBeenCalledWith("n1", "<b>ok</b>");
  });
});

describe("noteService sanitising on read", () => {
  const TRUSTED = { orgId: null } as const;
  const dirty = '<p>hi &amp; bye</p><script>x</script><a href="javascript:alert(1)">l</a>';
  const row = (content: string | null) => ({ id: "n1", content, author_name: "A" }) as never;

  it("cleans content (and replies) in list by transaction", async () => {
    vi.mocked(noteRepository.findByTransactionId).mockResolvedValue([row(dirty), { ...(row(dirty) as object), parent_id: "n1" } as never, row(null)]);
    const out = await noteService.listByTransactionId("t1", TRUSTED);
    expect(out[0].content).toBe("<p>hi &amp; bye</p><a target=\"_blank\" rel=\"noopener noreferrer\">l</a>");
    expect(out[1].content).not.toMatch(/script|javascript:/i);
    expect(out[2].content).toBeNull();
  });

  it("cleans content in list by client", async () => {
    vi.mocked(noteRepository.findByClientId).mockResolvedValue([row(dirty)]);
    const out = await noteService.listByClientId("c1", TRUSTED);
    expect(out[0].content).not.toMatch(/script|javascript:/i);
    expect(out[0].content).toContain("&amp;");
    expect(out[0].content).not.toContain("&amp;amp;");
  });

  it("cleans content in getNote", async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(row(dirty));
    const n = await noteService.getNote("n1", TRUSTED);
    expect(n.content).not.toMatch(/script|javascript:/i);
  });
});
