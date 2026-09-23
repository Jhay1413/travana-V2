import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./audit.repository", () => ({
  auditRepository: {
    findActiveQuoteById: vi.fn(),
    resolveEntityClient: vi.fn(),
    recordDeletionAndSoftDeleteQuote: vi.fn(),
    recordDeletionAndPromoteSibling: vi.fn(),
  },
}));
vi.mock("../quote/quote.repository", () => ({
  newQuoteRepository: {
    countActiveSiblings: vi.fn(),
    findById: vi.fn(),
  },
}));

import { auditService } from "./audit.service";
import { auditRepository } from "./audit.repository";
import { newQuoteRepository } from "../quote/quote.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = { orgId: "org-1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auditRepository.resolveEntityClient).mockResolvedValue({
    orgId: "org-1", clientId: "client-1", clientName: "Some Client",
  } as never);
});

describe("auditService.deleteQuote", () => {
  it("throws 404 when the quote does not exist", async () => {
    vi.mocked(auditRepository.findActiveQuoteById).mockResolvedValue(undefined as never);

    await expect(
      auditService.deleteQuote(SCOPE, { id: "q1", reason: "bad", performedBy: "user-1", performedByName: "Agent" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("deletes a primary quote with no siblings cleanly, no prompt needed", async () => {
    vi.mocked(auditRepository.findActiveQuoteById).mockResolvedValue({
      id: "q1", transaction_id: "t1", isQuoteCopy: false, title: "Main quote",
    } as never);
    vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(0 as never);

    await auditService.deleteQuote(SCOPE, { id: "q1", reason: "bad", performedBy: "user-1", performedByName: "Agent" });

    expect(auditRepository.recordDeletionAndSoftDeleteQuote).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "q1" }),
    );
    expect(auditRepository.recordDeletionAndPromoteSibling).not.toHaveBeenCalled();
  });

  it("rejects deleting a primary with siblings when newPrimaryQuoteId is missing", async () => {
    vi.mocked(auditRepository.findActiveQuoteById).mockResolvedValue({
      id: "q1", transaction_id: "t1", isQuoteCopy: false, title: "Main quote",
    } as never);
    vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(1 as never);

    await expect(
      auditService.deleteQuote(SCOPE, { id: "q1", reason: "bad", performedBy: "user-1", performedByName: "Agent" }),
    ).rejects.toMatchObject({ statusCode: 400, message: "NEW_PRIMARY_REQUIRED" });
    expect(auditRepository.recordDeletionAndSoftDeleteQuote).not.toHaveBeenCalled();
    expect(auditRepository.recordDeletionAndPromoteSibling).not.toHaveBeenCalled();
  });

  it("promotes the chosen sibling and deletes the old primary when a valid newPrimaryQuoteId is given", async () => {
    vi.mocked(auditRepository.findActiveQuoteById).mockResolvedValue({
      id: "q1", transaction_id: "t1", isQuoteCopy: false, title: "Main quote",
    } as never);
    vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(1 as never);
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q2", transaction_id: "t1", isQuoteCopy: true, quote_status: "quoted",
    } as never);

    await auditService.deleteQuote(SCOPE, {
      id: "q1", reason: "bad", performedBy: "user-1", performedByName: "Agent", newPrimaryQuoteId: "q2",
    });

    expect(auditRepository.recordDeletionAndPromoteSibling).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "q1", newPrimaryId: "q2", newPrimaryExpiry: expect.any(Date) }),
    );
    expect(auditRepository.recordDeletionAndSoftDeleteQuote).not.toHaveBeenCalled();
  });

  it("rejects a newPrimaryQuoteId that belongs to a different transaction", async () => {
    vi.mocked(auditRepository.findActiveQuoteById).mockResolvedValue({
      id: "q1", transaction_id: "t1", isQuoteCopy: false, title: "Main quote",
    } as never);
    vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(1 as never);
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q9", transaction_id: "t-other", isQuoteCopy: true, quote_status: "quoted",
    } as never);

    await expect(
      auditService.deleteQuote(SCOPE, {
        id: "q1", reason: "bad", performedBy: "user-1", performedByName: "Agent", newPrimaryQuoteId: "q9",
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: "INVALID_NEW_PRIMARY" });
    expect(auditRepository.recordDeletionAndPromoteSibling).not.toHaveBeenCalled();
    expect(auditRepository.recordDeletionAndSoftDeleteQuote).not.toHaveBeenCalled();
  });

  it("rejects a newPrimaryQuoteId that is soft-deleted", async () => {
    vi.mocked(auditRepository.findActiveQuoteById).mockResolvedValue({
      id: "q1", transaction_id: "t1", isQuoteCopy: false, title: "Main quote",
    } as never);
    vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(1 as never);
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q2", transaction_id: "t1", isQuoteCopy: true, quote_status: "quoted", deleted_at: new Date(),
    } as never);

    await expect(
      auditService.deleteQuote(SCOPE, {
        id: "q1", reason: "bad", performedBy: "user-1", performedByName: "Agent", newPrimaryQuoteId: "q2",
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: "INVALID_NEW_PRIMARY" });
    expect(auditRepository.recordDeletionAndPromoteSibling).not.toHaveBeenCalled();
    expect(auditRepository.recordDeletionAndSoftDeleteQuote).not.toHaveBeenCalled();
  });

  it("deletes a non-primary copy without triggering the sibling guard", async () => {
    vi.mocked(auditRepository.findActiveQuoteById).mockResolvedValue({
      id: "q2", transaction_id: "t1", isQuoteCopy: true, title: "Copy quote",
    } as never);

    await auditService.deleteQuote(SCOPE, { id: "q2", reason: "bad", performedBy: "user-1", performedByName: "Agent" });

    expect(newQuoteRepository.countActiveSiblings).not.toHaveBeenCalled();
    expect(auditRepository.recordDeletionAndSoftDeleteQuote).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "q2" }),
    );
  });
});
