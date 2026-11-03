import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./transaction.repository", () => ({
  transactionRepository: {
    findById: vi.fn(),
    findByIdScopedForWrite: vi.fn(),
    findWithDetails: vi.fn(),
    create: vi.fn(),
    createWithEnquiryAndChildren: vi.fn(),
    createWithQuoteAndChildren: vi.fn(),
    createWithBookingAndChildren: vi.fn(),
    update: vi.fn(),
    updateAndRehome: vi.fn(),
    remove: vi.fn(),
    findExpiringQuotes: vi.fn(),
    findPipelineByStatus: vi.fn(),
    findPipelineCandidates: vi.fn(),
    countPipelineQuickByColumn: vi.fn(),
    applyFutureDeal: vi.fn(),
    applyLost: vi.fn(),
  },
}));
vi.mock("../enquiry/enquiry.repository", () => ({
  enquiryTableRepository: {
    findByTransactionId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activateDueFutureDeals: vi.fn(),
    addDestination: vi.fn(),
    addResort: vi.fn(),
    addAccommodation: vi.fn(),
    addBoardBasis: vi.fn(),
    addDepartureAirport: vi.fn(),
    addPassenger: vi.fn(),
  },
}));
vi.mock("../quote/quote.repository", () => ({
  newQuoteRepository: {
    findByTransactionId: vi.fn(),
    updateNonCopyByTransactionId: vi.fn(),
    activateDueFutureDeals: vi.fn(),
    replaceTransfers: vi.fn(),
    replaceCarHires: vi.fn(),
    replaceAttractionTickets: vi.fn(),
    replaceLoungePasses: vi.fn(),
    replaceAirportParkings: vi.fn(),
    replaceExtraAccommodations: vi.fn(),
    replaceChildPassengers: vi.fn(),
    quoteInScope: vi.fn(),
    findTourOperatorIds: vi.fn(),
    upsertCruise: vi.fn(),
  },
}));
vi.mock("../booking/booking.repository", () => ({
  bookingRepository: {
    findByTransactionId: vi.fn(),
    countByClientId: vi.fn(),
    addTransfer: vi.fn(),
    addCarHire: vi.fn(),
    addAttractionTicket: vi.fn(),
    addLoungePass: vi.fn(),
    addAirportParking: vi.fn(),
    addAccommodation: vi.fn(),
    upsertCruise: vi.fn(),
  },
}));
vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserIdInOrg: vi.fn(), findActiveContextByUserId: vi.fn(), findDefaultOwner: vi.fn() },
}));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn(), findOrgIdById: vi.fn() } }));
vi.mock("../note/note.repository", () => ({ noteRepository: { create: vi.fn() } }));
vi.mock("../task/task.service", () => ({ taskService: { reassignByEntity: vi.fn() } }));
vi.mock("../quote/quote.service", () => ({ newQuoteService: { createQuote: vi.fn() } }));
vi.mock("../referral/referral.service", () => ({ referralService: { createReferral: vi.fn(), ensureReferralForBooking: vi.fn() } }));
vi.mock("../../../services/vipEnrollment.service", () => ({ vipEnrollmentService: { enrollClient: vi.fn() } }));
vi.mock("../wallet/wallet.service", () => ({ walletService: { applyBookingCredit: vi.fn() } }));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { findById: vi.fn(), findByIdForDealCreate: vi.fn(), update: vi.fn() } }));
vi.mock("../tour-operator/tour-operator-link.service", () => ({
  tourOperatorLinkService: { assertPayloadOperatorsLinked: vi.fn() },
}));

import { HAYS_REF_MESSAGE } from "@shared/booking-refs";
import { transactionService } from "./transaction.service";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { branchRepository } from "../branch/branch.repository";
import { transactionRepository } from "./transaction.repository";
import { newQuoteRepository } from "../quote/quote.repository";
import { newQuoteService } from "../quote/quote.service";
import { bookingRepository } from "../booking/booking.repository";
import { enquiryTableRepository } from "../enquiry/enquiry.repository";
import { noteRepository } from "../note/note.repository";
import { taskService } from "../task/task.service";
import { walletService } from "../wallet/wallet.service";
import { referralService } from "../referral/referral.service";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { tourOperatorLinkService } from "../tour-operator/tour-operator-link.service";

// transaction.service takes a real Scope; the repo is mocked so the value is opaque.
const SCOPE = { orgId: "org1", branchId: "shop1", orgRole: "agent", userId: "u1" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchId: "shop1", branchType: "shop", orgId: "org1" } as never);
});

describe("transactionService.getTransactionById", () => {
  it("throws 404 when the transaction is missing", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(transactionService.getTransactionById("t1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns the transaction when found", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1" } as never);

    await expect(transactionService.getTransactionById("t1", SCOPE)).resolves.toMatchObject({ id: "t1" });
  });
});

describe("transactionService.updateTransaction", () => {
  it("rejects a status downgrade with 400", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_booking" } as never);
    vi.mocked(newQuoteRepository.findByTransactionId).mockResolvedValue([{ id: "q1" }] as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue({ id: "b1" } as never);

    await expect(transactionService.updateTransaction("t1", { status: "on_enquiry" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("rejects on_quote when the deal has no quote", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
    vi.mocked(newQuoteRepository.findByTransactionId).mockResolvedValue([] as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue(undefined as never);

    await expect(transactionService.updateTransaction("t1", { status: "on_quote" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects on_quote when the only quote is a copy", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
    vi.mocked(newQuoteRepository.findByTransactionId).mockResolvedValue([{ id: "q1", isQuoteCopy: true, isFreeQuote: false }] as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue(undefined as never);

    await expect(transactionService.updateTransaction("t1", { status: "on_quote" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("rejects on_booking when the only booking is lost", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_quote" } as never);
    vi.mocked(newQuoteRepository.findByTransactionId).mockResolvedValue([] as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue({ id: "b1", booking_status: "LOST" } as never);

    await expect(transactionService.updateTransaction("t1", { status: "on_booking" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("allows a forward move backed by a quote", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
    vi.mocked(newQuoteRepository.findByTransactionId).mockResolvedValue([{ id: "q1" }] as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue(undefined as never);
    vi.mocked(transactionRepository.update).mockResolvedValue({ id: "t1", status: "on_quote" } as never);

    await expect(transactionService.updateTransaction("t1", { status: "on_quote" }, SCOPE)).resolves.toMatchObject({ status: "on_quote" });
  });

  it("throws 404 when the transaction does not exist", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(transactionService.updateTransaction("t1", { status: "on_quote" }, SCOPE)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("reassigns related tasks when the owning user changes", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", user_id: "old" } as never);
    vi.mocked(transactionRepository.update).mockResolvedValue({ id: "t1", user_id: "new" } as never);
    vi.mocked(newQuoteRepository.findByTransactionId).mockResolvedValue([{ id: "q1" }] as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(enquiryTableRepository.findByTransactionId).mockResolvedValue({ id: "e1" } as never);

    await transactionService.updateTransaction("t1", { user_id: "new" }, SCOPE);

    expect(taskService.reassignByEntity).toHaveBeenCalledWith("quote", "q1", "new");
    expect(taskService.reassignByEntity).toHaveBeenCalledWith("booking", "b1", "new");
    expect(taskService.reassignByEntity).toHaveBeenCalledWith("enquiry", "e1", "new");
  });

  it("does NOT reassign tasks when the user is unchanged", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", user_id: "same" } as never);
    vi.mocked(transactionRepository.update).mockResolvedValue({ id: "t1", user_id: "same" } as never);

    await transactionService.updateTransaction("t1", { user_id: "same" }, SCOPE);

    expect(taskService.reassignByEntity).not.toHaveBeenCalled();
  });
});

describe("transactionService.updateTransaction deal reassignment across the partition (Q2)", () => {
  const ADMIN = { orgId: "org1", orgRole: "org_admin", orgRoles: ["org_admin"], branchType: "shop" } as never;
  const AGENT = { orgId: "org1", orgRole: "agent", orgRoles: ["agent"], branchType: "shop" } as never;
  const HOMEWORKER = { orgId: "org1", orgRole: "homeworker", orgRoles: ["homeworker"], branchType: "homeworker" } as never;

  beforeEach(() => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", user_id: "old", branch_id: "shop1" } as never);
    vi.mocked(transactionRepository.update).mockResolvedValue({ id: "t1" } as never);
    vi.mocked(transactionRepository.updateAndRehome).mockResolvedValue({ id: "t1" } as never);
    vi.mocked(newQuoteRepository.findByTransactionId).mockResolvedValue([] as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue(undefined as never);
    vi.mocked(enquiryTableRepository.findByTransactionId).mockResolvedValue(undefined as never);
  });

  it("admin handing a deal to a homeworker re-homes it (with its tasks and tickets) into their branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchId: "hw1", branchType: "homeworker", orgId: "org1" } as never);
    await transactionService.updateTransaction("t1", { user_id: "hw" }, ADMIN);
    expect(branchMemberRepository.findActiveContextByUserIdInOrg).toHaveBeenCalledWith("hw", "org1");
    expect(transactionRepository.updateAndRehome).toHaveBeenCalledWith("t1", { user_id: "hw" }, ADMIN, "hw1");
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("admin moving a deal back to shop staff re-homes it into the shop branch", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", user_id: "hw", branch_id: "hw1" } as never);
    await transactionService.updateTransaction("t1", { user_id: "u2" }, ADMIN);
    expect(transactionRepository.updateAndRehome).toHaveBeenCalledWith("t1", { user_id: "u2" }, ADMIN, "shop1");
  });

  it("no re-home when the new owner is already in the deal's branch", async () => {
    await transactionService.updateTransaction("t1", { user_id: "u2" }, ADMIN);
    expect(transactionRepository.updateAndRehome).not.toHaveBeenCalled();
    expect(transactionRepository.update).toHaveBeenCalled();
  });

  it("non-admin shop staff get 400 handing a deal to a homeworker", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchId: "hw1", branchType: "homeworker", orgId: "org1" } as never);
    await expect(transactionService.updateTransaction("t1", { user_id: "hw" }, AGENT)).rejects.toMatchObject({ statusCode: 400 });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("a homeworker gets 400 handing a deal to shop staff", async () => {
    await expect(transactionService.updateTransaction("t1", { user_id: "u2" }, HOMEWORKER)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("400s when the new owner is not an active member of the org", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue(undefined as never);
    await expect(transactionService.updateTransaction("t1", { user_id: "foreign" }, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("strips org_id and (for non-admins) branch_id from the patch", async () => {
    await transactionService.updateTransaction("t1", { org_id: "evil", branch_id: "evil-b" } as never, AGENT);
    expect(vi.mocked(transactionRepository.update).mock.calls[0][1]).toEqual({});
  });

  it("lets an admin set branch_id only inside their org", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValueOnce({ id: "b2" } as never);
    await transactionService.updateTransaction("t1", { branch_id: "b2" } as never, ADMIN);
    expect(vi.mocked(transactionRepository.update).mock.calls[0][1]).toEqual({ branch_id: "b2" });
    vi.mocked(branchRepository.findById).mockResolvedValueOnce(null);
    await expect(transactionService.updateTransaction("t1", { branch_id: "foreign" } as never, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("transactionService.deleteTransaction", () => {
  it("403s (another shop) when nothing was removed but the deal is readable", async () => {
    vi.mocked(transactionRepository.remove).mockResolvedValue(false as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1" } as never);
    await expect(transactionService.deleteTransaction("t1", SCOPE)).rejects.toMatchObject({ statusCode: 403, message: "This deal belongs to another shop" });
  });

  it("throws 404 when nothing was removed", async () => {
    vi.mocked(transactionRepository.remove).mockResolvedValue(false as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(transactionService.deleteTransaction("t1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resolves when the transaction is removed", async () => {
    vi.mocked(transactionRepository.remove).mockResolvedValue(true as never);

    await expect(transactionService.deleteTransaction("t1", SCOPE)).resolves.toBeUndefined();
  });
});

describe("transactionService.updatePriority", () => {
  it("403s for a readable deal in another shop", async () => {
    vi.mocked(transactionRepository.update).mockResolvedValue(undefined as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1" } as never);
    await expect(transactionService.updatePriority("t1", "high", SCOPE)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 404 when the transaction does not exist", async () => {
    vi.mocked(transactionRepository.update).mockResolvedValue(undefined as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(transactionService.updatePriority("t1", "high", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("updates the transaction's priority", async () => {
    vi.mocked(transactionRepository.update).mockResolvedValue({ id: "t1", priority: "high" } as never);

    const result = await transactionService.updatePriority("t1", "high", SCOPE);

    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { priority: "high" }, SCOPE);
    expect(result).toEqual({ id: "t1", priority: "high" });
  });
});

describe("transactionService.setFutureDeal", () => {
  it("403s for a readable deal in another shop (future and lost)", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue(undefined as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1" } as never);
    await expect(transactionService.setFutureDeal("t1", "2099-01-01", SCOPE)).rejects.toMatchObject({ statusCode: 403 });
    await expect(transactionService.setLost("t1", true, SCOPE)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("updateTransaction 403s when the write scope refuses a readable deal", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_quote" } as never);
    vi.mocked(transactionRepository.update).mockResolvedValue(undefined as never);
    await expect(transactionService.updateTransaction("t1", { priority: "high" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 404 when the transaction does not exist", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue(undefined as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(transactionService.setFutureDeal("t1", "2099-01-01", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("uses the branch-pinned scoped lookup (not the org-only findById)", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
    vi.mocked(transactionRepository.applyFutureDeal).mockResolvedValue(1 as never);

    await transactionService.setFutureDeal("t1", "2099-01-01", SCOPE);

    expect(transactionRepository.findByIdScopedForWrite).toHaveBeenCalledWith("t1", SCOPE);
    expect(transactionRepository.findById).not.toHaveBeenCalled();
  });

  it("throws 400 for an on_booking transaction", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_booking" } as never);

    await expect(transactionService.setFutureDeal("t1", "2099-01-01", SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the transaction has no enquiry/quote row to update", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
    vi.mocked(transactionRepository.applyFutureDeal).mockResolvedValue(0 as never);

    await expect(transactionService.setFutureDeal("t1", "2099-01-01", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("applies the future-deal date atomically via the repository for on_enquiry", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
    vi.mocked(transactionRepository.applyFutureDeal).mockResolvedValue(1 as never);

    const result = await transactionService.setFutureDeal("t1", "2099-01-01", SCOPE);

    expect(transactionRepository.applyFutureDeal).toHaveBeenCalledWith("t1", "on_enquiry", "2099-01-01");
    expect(result).toEqual({ id: "t1", is_future_deal: true, future_deal_date: "2099-01-01" });
  });

  it("passes a null date through to the repository when clearing on_quote — this is what triggers the repo's stale-expiry bump", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_quote" } as never);
    vi.mocked(transactionRepository.applyFutureDeal).mockResolvedValue(1 as never);

    const result = await transactionService.setFutureDeal("t1", null, SCOPE);

    expect(transactionRepository.applyFutureDeal).toHaveBeenCalledWith("t1", "on_quote", null);
    expect(result).toEqual({ id: "t1", is_future_deal: false, future_deal_date: null });
  });
});

describe("transactionService.setLost", () => {
  it("uses the branch-pinned scoped lookup (not the org-only findById)", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
    vi.mocked(transactionRepository.applyLost).mockResolvedValue(1 as never);

    await transactionService.setLost("t1", true, SCOPE);

    expect(transactionRepository.findByIdScopedForWrite).toHaveBeenCalledWith("t1", SCOPE);
    expect(transactionRepository.findById).not.toHaveBeenCalled();
  });

  it("throws 400 for an on_booking transaction", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_booking" } as never);

    await expect(transactionService.setLost("t1", true, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the transaction has no enquiry/quote row to update", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_quote" } as never);
    vi.mocked(transactionRepository.applyLost).mockResolvedValue(0 as never);

    await expect(transactionService.setLost("t1", true, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("marks the enquiry lost atomically via the repository for on_enquiry", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
    vi.mocked(transactionRepository.applyLost).mockResolvedValue(1 as never);

    const result = await transactionService.setLost("t1", true, SCOPE);

    expect(transactionRepository.applyLost).toHaveBeenCalledWith("t1", "on_enquiry", true);
    expect(result).toEqual({ id: "t1", lost: true });
  });

  it("passes lost=false through to the repository when restoring on_quote — this is what triggers the repo's stale-expiry bump", async () => {
    vi.mocked(transactionRepository.findByIdScopedForWrite).mockResolvedValue({ id: "t1", status: "on_quote" } as never);
    vi.mocked(transactionRepository.applyLost).mockResolvedValue(1 as never);

    const result = await transactionService.setLost("t1", false, SCOPE);

    expect(transactionRepository.applyLost).toHaveBeenCalledWith("t1", "on_quote", false);
    expect(result).toEqual({ id: "t1", lost: false });
  });
});

describe("transactionService.getExpiringQuotes — classification", () => {
  it("classifies a past expiry as expired and a future expiry as near_expiry", async () => {
    vi.mocked(transactionRepository.findExpiringQuotes).mockResolvedValue([
      {
        quoteId: "q-past",
        clientId: "c1",
        clientFirstName: "Ada",
        clientSurename: "Lovelace",
        salesPrice: "100",
        dateCreated: "2026-01-01",
        dateExpiry: "2000-01-01",
        transactionId: "t1",
      },
      {
        quoteId: "q-future",
        clientId: "c2",
        clientFirstName: "Grace",
        clientSurename: "Hopper",
        salesPrice: "200",
        dateCreated: "2026-01-01",
        dateExpiry: "2999-01-01",
        transactionId: "t2",
      },
    ] as never);

    const result = await transactionService.getExpiringQuotes(SCOPE);

    expect(result[0]).toMatchObject({ id: "q-past", status: "expired", clientName: "Ada Lovelace" });
    expect(result[1]).toMatchObject({ id: "q-future", status: "near_expiry", clientName: "Grace Hopper" });
  });

  it("falls back to 'Unknown Client' when no name parts are present", async () => {
    vi.mocked(transactionRepository.findExpiringQuotes).mockResolvedValue([
      {
        quoteId: "q1",
        clientId: "c1",
        clientTitle: "NULL",
        salesPrice: "100",
        dateCreated: "2026-01-01",
        dateExpiry: "2999-01-01",
        transactionId: "t1",
      },
    ] as never);

    const result = await transactionService.getExpiringQuotes(SCOPE);

    expect(result[0].clientName).toBe("Unknown Client");
  });
});

describe("transactionService.createTransactionWithEnquiry — add enquiry", () => {
  beforeEach(() => {
    vi.mocked(transactionRepository.createWithEnquiryAndChildren).mockResolvedValue({
      transaction: { id: "txn1" },
      enquiry: { id: "enq1" },
    } as never);
  });

  const lastInsert = () => vi.mocked(transactionRepository.createWithEnquiryAndChildren).mock.calls.at(-1)![0];

  it("creates the transaction and enquiry in one atomic repository call", async () => {
    const result = await transactionService.createTransactionWithEnquiry(
      { user_id: "u1" } as never,
      { travel_date: "2026-07-01", holiday_type_id: "h1" } as never,
      SCOPE,
    );

    expect(transactionRepository.createWithEnquiryAndChildren).toHaveBeenCalledOnce();
    expect(lastInsert()).toMatchObject({
      transactionData: { user_id: "u1" },
      enquiryFields: { travel_date: "2026-07-01", holiday_type_id: "h1" },
      scope: SCOPE,
    });
    // No separate, non-atomic inserts any more.
    expect(transactionRepository.create).not.toHaveBeenCalled();
    expect(enquiryTableRepository.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ transaction: { id: "txn1" }, enquiry: { id: "enq1" } });
  });

  it("passes the multi-value relations, passengers (age defaults to 0) and notes through", async () => {
    await transactionService.createTransactionWithEnquiry(
      {} as never,
      {
        destinations: ["d1", "d2"],
        passengers: [{ type: "adult" }, { type: "child", age: 7 }],
        notes: "Wants a beach resort",
      } as never,
      SCOPE,
      "agent1",
    );

    expect(lastInsert()).toMatchObject({
      destinations: ["d1", "d2"],
      passengers: [{ type: "adult", age: 0 }, { type: "child", age: 7 }],
      notes: [{ content: "Wants a beach resort", agent_id: "agent1" }],
    });
    // Notes go through the atomic call, not the separate note repository.
    expect(noteRepository.create).not.toHaveBeenCalled();
    // Relation arrays are not left inside the enquiry columns.
    expect(lastInsert().enquiryFields).not.toHaveProperty("destinations");
    expect(lastInsert().enquiryFields).not.toHaveProperty("passengers");
    expect(lastInsert().enquiryFields).not.toHaveProperty("notes");
  });

  it("skips a truthy non-array relation or passengers value instead of throwing (as the old length checks did)", async () => {
    await transactionService.createTransactionWithEnquiry(
      {} as never,
      { passengers: { type: "adult" }, destinations: "d1", resorts: 5 } as never,
      SCOPE,
    );
    const insert = lastInsert();
    expect(insert.passengers).toBeUndefined();
    expect(insert.destinations).toBeUndefined();
    expect(insert.resorts).toBeUndefined();
  });

  it("sanitises enquiry note HTML before saving", async () => {
    await transactionService.createTransactionWithEnquiry(
      {} as never,
      { notes: "<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>" } as never,
      SCOPE,
    );
    expect(lastInsert().notes?.[0].content).toBe("<p>ok</p>");
  });

  it("propagates a repository failure (the repository rolls back, nothing else is written)", async () => {
    vi.mocked(transactionRepository.createWithEnquiryAndChildren).mockRejectedValue(new Error("not null violation"));
    await expect(
      transactionService.createTransactionWithEnquiry({} as never, { title: "No type" } as never, SCOPE),
    ).rejects.toThrow("not null violation");
    expect(transactionRepository.create).not.toHaveBeenCalled();
  });
});

describe("transactionService.createTransactionWithQuote — add quote", () => {
  beforeEach(() => {
    vi.mocked(transactionRepository.createWithQuoteAndChildren).mockResolvedValue({
      transaction: { id: "txn1", user_id: "u1" },
      quote: { id: "q1" },
    } as never);
    vi.mocked(transactionRepository.create).mockResolvedValue({ id: "freeTxn" } as never);
  });

  it("creates the quote+children and replaces provided line items", async () => {
    const result = await transactionService.createTransactionWithQuote(
      { is_test: false } as never,
      { not_for_social: true, transfers: [{ booking_ref: "T1" }] } as never,
      SCOPE,
    );

    expect(transactionRepository.createWithQuoteAndChildren).toHaveBeenCalledOnce();
    expect(newQuoteRepository.replaceTransfers).toHaveBeenCalledWith("q1", [{ booking_ref: "T1" }]);
    expect(result).toMatchObject({ quote: { id: "q1" } });
  });

  it("drops unacceptable gallery strings, saves the rest and reports the skipped ones", async () => {
    const result = await transactionService.createTransactionWithQuote(
      { is_test: false } as never,
      { not_for_social: true, images: ["https://cdn.test/a.jpg", null, "//cdn.test/b.jpg", "www.cdn.test/c.jpg"] } as never,
      SCOPE,
    );
    expect(vi.mocked(transactionRepository.createWithQuoteAndChildren).mock.calls[0][0].images).toEqual(["https://cdn.test/a.jpg"]);
    expect(result.skippedImageUrls).toEqual(["(not an image link)", "//cdn.test/b.jpg", "www.cdn.test/c.jpg"]);
  });

  it("saves child ages as passenger rows for the new quote", async () => {
    await transactionService.createTransactionWithQuote(
      { is_test: false } as never,
      { not_for_social: true, childAges: [5, 9] } as never,
      SCOPE,
    );

    expect(newQuoteRepository.replaceChildPassengers).toHaveBeenCalledWith("q1", "quote", [5, 9]);
    // They are a passengers concern, not a quote column.
    const insert = vi.mocked(transactionRepository.createWithQuoteAndChildren).mock.calls[0][0] as { quoteFields: Record<string, unknown> };
    expect(insert.quoteFields).not.toHaveProperty("childAges");
  });

  it("writes no passenger rows when childAges was not sent", async () => {
    await transactionService.createTransactionWithQuote({ is_test: false } as never, { not_for_social: true } as never, SCOPE);
    expect(newQuoteRepository.replaceChildPassengers).not.toHaveBeenCalled();
  });

  it("hands the child ages to the free social copy too", async () => {
    vi.mocked(newQuoteService.createQuote).mockResolvedValue({ id: "freeQ" } as never);
    await transactionService.createTransactionWithQuote({ is_test: false } as never, { childAges: [4] } as never, SCOPE);
    expect(vi.mocked(newQuoteService.createQuote).mock.calls[0][0]).toMatchObject({ childAges: [4] });
  });

  it("spins off a free social quote unless the quote is marked not_for_social / is_test", async () => {
    vi.mocked(newQuoteService.createQuote).mockResolvedValue({ id: "freeQ" } as never);

    await transactionService.createTransactionWithQuote(
      { is_test: false } as never,
      { not_for_social: false } as never,
      SCOPE,
    );

    expect(newQuoteService.createQuote).toHaveBeenCalledOnce();
  });

  it("does NOT create a free quote when not_for_social is set", async () => {
    await transactionService.createTransactionWithQuote(
      { is_test: false } as never,
      { not_for_social: true } as never,
      SCOPE,
    );

    expect(newQuoteService.createQuote).not.toHaveBeenCalled();
  });
});

describe("transactionService - operator must be in the org's list", () => {
  const OP_A = "11111111-1111-4111-8111-111111111111";
  const OP_B = "22222222-2222-4222-8222-222222222222";

  it("createTransactionWithQuote checks the main and line-item operators before writing", async () => {
    vi.mocked(tourOperatorLinkService.assertPayloadOperatorsLinked).mockRejectedValueOnce(new Error("Tour operator is not in your list"));
    await expect(
      transactionService.createTransactionWithQuote(
        {} as never,
        { main_tour_operator_id: OP_A, transfers: [{ tour_operator_id: OP_B }] } as never,
        SCOPE,
      ),
    ).rejects.toThrow("Tour operator is not in your list");
    expect(tourOperatorLinkService.assertPayloadOperatorsLinked).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ main_tour_operator_id: OP_A, transfers: [{ tour_operator_id: OP_B }] }),
      expect.any(Function),
    );
    expect(transactionRepository.createWithQuoteAndChildren).not.toHaveBeenCalled();
  });

  it("createTransactionWithBooking checks the operators before writing", async () => {
    vi.mocked(tourOperatorLinkService.assertPayloadOperatorsLinked).mockRejectedValueOnce(new Error("Tour operator is not in your list"));
    await expect(
      transactionService.createTransactionWithBooking({} as never, { main_tour_operator_id: OP_A } as never, SCOPE),
    ).rejects.toThrow("Tour operator is not in your list");
    expect(tourOperatorLinkService.assertPayloadOperatorsLinked).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ main_tour_operator_id: OP_A }),
      expect.any(Function),
    );
    expect(transactionRepository.createWithBookingAndChildren).not.toHaveBeenCalled();
  });
});

describe("transactionService.createTransactionWithQuote - source_quote_id (copy to client)", () => {
  beforeEach(() => {
    vi.mocked(transactionRepository.createWithQuoteAndChildren).mockResolvedValue({
      transaction: { id: "txn1", user_id: "u1" },
      quote: { id: "q1" },
    } as never);
    vi.mocked(newQuoteRepository.findTourOperatorIds).mockResolvedValue(["op-source"]);
  });

  it("exempts the source quote's operators and strips source_quote_id before the insert", async () => {
    vi.mocked(newQuoteRepository.quoteInScope).mockResolvedValue(true as never);
    await transactionService.createTransactionWithQuote(
      {} as never,
      { source_quote_id: "src1", main_tour_operator_id: "op-source", not_for_social: true } as never,
      SCOPE,
    );
    const [, payload, loadExisting] = vi.mocked(tourOperatorLinkService.assertPayloadOperatorsLinked).mock.calls.at(-1)!;
    expect(payload).not.toHaveProperty("source_quote_id");
    await expect(loadExisting()).resolves.toEqual(["op-source"]);
    expect(newQuoteRepository.findTourOperatorIds).toHaveBeenCalledWith("src1");
    const insert = vi.mocked(transactionRepository.createWithQuoteAndChildren).mock.calls[0][0] as { quoteFields: Record<string, unknown> };
    expect(insert.quoteFields).not.toHaveProperty("source_quote_id");
    expect(insert.quoteFields).toMatchObject({ main_tour_operator_id: "op-source" });
  });

  it("404s and inserts nothing when the source quote is outside the caller's org", async () => {
    vi.mocked(newQuoteRepository.quoteInScope).mockResolvedValue(false as never);
    await expect(
      transactionService.createTransactionWithQuote({} as never, { source_quote_id: "other-org", main_tour_operator_id: "op-x" } as never, SCOPE),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(transactionRepository.createWithQuoteAndChildren).not.toHaveBeenCalled();
    expect(tourOperatorLinkService.assertPayloadOperatorsLinked).not.toHaveBeenCalled();
  });

  it("without a source id nothing is looked up", async () => {
    await transactionService.createTransactionWithQuote({} as never, { not_for_social: true } as never, SCOPE);
    const [, , loadExisting] = vi.mocked(tourOperatorLinkService.assertPayloadOperatorsLinked).mock.calls.at(-1)!;
    await expect(loadExisting()).resolves.toEqual([]);
    expect(newQuoteRepository.quoteInScope).not.toHaveBeenCalled();
  });
});

describe("transactionService.createTransactionWithBooking — add booking", () => {
  beforeEach(() => {
    vi.mocked(transactionRepository.createWithBookingAndChildren).mockResolvedValue({
      transaction: { id: "txn1", client_id: "c1" },
      booking: { id: "b1", travel_date: null, package_commission: null },
    } as never);
    vi.mocked(neonClientRepository.findByIdForDealCreate).mockResolvedValue({ id: "c1", referredByClientId: null } as never);
    vi.mocked(bookingRepository.countByClientId).mockResolvedValue(1 as never);
  });

  it("creates the booking+children and adds provided transfers", async () => {
    const result = await transactionService.createTransactionWithBooking(
      {} as never,
      { transfers: [{ booking_ref: "T1" }] } as never,
      SCOPE,
    );

    expect(transactionRepository.createWithBookingAndChildren).toHaveBeenCalledOnce();
    expect(bookingRepository.addTransfer).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ booking: { id: "b1" } });
  });

  it("rejects a malformed HAYS Ref with 400 before any write", async () => {
    await expect(
      transactionService.createTransactionWithBooking({} as never, { hays_ref: "ABC123" } as never, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400, message: HAYS_REF_MESSAGE });
    expect(transactionRepository.createWithBookingAndChildren).not.toHaveBeenCalled();
  });

  it("saves a valid HAYS Ref in canonical form", async () => {
    await transactionService.createTransactionWithBooking({} as never, { hays_ref: " hay 1234567 " } as never, SCOPE);
    const arg = vi.mocked(transactionRepository.createWithBookingAndChildren).mock.calls[0][0] as unknown as { bookingFields: { hays_ref: string } };
    expect(arg.bookingFields.hays_ref).toBe("HAY-1234567");
  });

  it("allows a blank HAYS Ref", async () => {
    await transactionService.createTransactionWithBooking({} as never, { hays_ref: "" } as never, SCOPE);
    const arg = vi.mocked(transactionRepository.createWithBookingAndChildren).mock.calls[0][0] as unknown as { bookingFields: { hays_ref: string } };
    expect(arg.bookingFields.hays_ref).toBe("");
  });

  it("applies wallet credit when the booking carries a positive wallet_credit", async () => {
    await transactionService.createTransactionWithBooking(
      {} as never,
      { wallet_credit: "50" } as never,
      SCOPE,
    );

    expect(walletService.applyBookingCredit).toHaveBeenCalledWith("c1", "b1", 50, SCOPE);
  });

  it("delegates referral recording to ensureReferralForBooking when the client was referred", async () => {
    vi.mocked(neonClientRepository.findByIdForDealCreate).mockResolvedValue({
      id: "c1",
      referredByClientId: "ref1",
      firstName: "Ada",
      surename: "Lovelace",
    } as never);

    await transactionService.createTransactionWithBooking({} as never, {} as never, SCOPE);

    expect(referralService.ensureReferralForBooking).toHaveBeenCalledOnce();
    const arg = vi.mocked(referralService.ensureReferralForBooking).mock.calls[0][0] as any;
    expect(arg.client).toMatchObject({ id: "c1", referredByClientId: "ref1" });
  });

  it("badges the client VIP at the 3-booking threshold", async () => {
    vi.mocked(bookingRepository.countByClientId).mockResolvedValue(3 as never);

    await transactionService.createTransactionWithBooking({} as never, {} as never, SCOPE);

    expect(neonClientRepository.update).toHaveBeenCalledWith("c1", { badge: "VIP Client" });
  });
});

describe("transactionService create: tenancy and ownership come from the caller, not the body (B1)", () => {
  const ADMIN = { orgId: "org1", branchId: "shop1", orgRole: "org_admin", userId: "admin1" } as never;
  const NO_SHOP = { orgId: "org1", branchId: null, orgRole: "agent", userId: "u1" } as never;
  const created = { transaction: { id: "txn1" }, enquiry: { id: "enq1" }, quote: { id: "q1" }, booking: { id: "b1" } };

  beforeEach(() => {
    vi.mocked(transactionRepository.create).mockResolvedValue({ id: "txn1" } as never);
    vi.mocked(transactionRepository.createWithEnquiryAndChildren).mockResolvedValue(created as never);
    vi.mocked(transactionRepository.createWithQuoteAndChildren).mockResolvedValue(created as never);
    vi.mocked(transactionRepository.createWithBookingAndChildren).mockResolvedValue(created as never);
    vi.mocked(neonClientRepository.findByIdForDealCreate).mockResolvedValue({ id: "c1" } as never);
  });

  const writes = () => [
    transactionRepository.create,
    transactionRepository.createWithEnquiryAndChildren,
    transactionRepository.createWithQuoteAndChildren,
    transactionRepository.createWithBookingAndChildren,
  ];

  it("ignores a body org_id and branch_id from an agent on every create path (the caller's org and shop are used)", async () => {
    const body = { client_id: "c1", user_id: "u1", org_id: "other-org", branch_id: "other-shop" } as never;
    await transactionService.createTransaction(body, SCOPE);
    await transactionService.createTransactionWithEnquiry(body, { holiday_type_id: "h" } as never, SCOPE);
    await transactionService.createTransactionWithQuote(body, {} as never, SCOPE);
    await transactionService.createTransactionWithBooking(body, {} as never, SCOPE);

    const datas = [
      vi.mocked(transactionRepository.create).mock.calls[0][0],
      vi.mocked(transactionRepository.createWithEnquiryAndChildren).mock.calls[0][0].transactionData,
      vi.mocked(transactionRepository.createWithQuoteAndChildren).mock.calls[0][0].transactionData,
      vi.mocked(transactionRepository.createWithBookingAndChildren).mock.calls[0][0].transactionData,
    ];
    for (const data of datas) {
      expect(data).toMatchObject({ client_id: "c1", user_id: "u1", org_id: "org1", branch_id: "shop1" });
    }
  });

  it("copies only the known deal columns (no id / created_at / status injection)", async () => {
    await transactionService.createTransaction({ id: "x", created_at: "2001-01-01", status: "on_booking", client_id: "c1", user_id: "u1", priority: "high" } as never, SCOPE);
    const data = vi.mocked(transactionRepository.create).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("created_at");
    expect(data).not.toHaveProperty("status");
    expect(data).toMatchObject({ priority: "high" });
  });

  it("lets an org admin pick a branch of their own org, and 400s on a foreign branch (nothing written)", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValueOnce({ id: "shop2" } as never);
    await transactionService.createTransaction({ user_id: "u1", branch_id: "shop2" } as never, ADMIN);
    expect(branchRepository.findById).toHaveBeenCalledWith("shop2", "org1");
    expect(vi.mocked(transactionRepository.create).mock.calls[0][0]).toMatchObject({ org_id: "org1", branch_id: "shop2" });

    vi.mocked(transactionRepository.create).mockClear();
    vi.mocked(branchRepository.findById).mockResolvedValueOnce(undefined as never);
    await expect(transactionService.createTransaction({ user_id: "u1", branch_id: "foreign" } as never, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it("404s on a client outside the caller's org and partition, and writes nothing", async () => {
    vi.mocked(neonClientRepository.findByIdForDealCreate).mockResolvedValue(undefined as never);
    const body = { client_id: "foreign-client", user_id: "u1" } as never;
    await expect(transactionService.createTransaction(body, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    await expect(transactionService.createTransactionWithEnquiry(body, { holiday_type_id: "h" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    await expect(transactionService.createTransactionWithQuote(body, {} as never, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    await expect(transactionService.createTransactionWithBooking(body, {} as never, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(neonClientRepository.findByIdForDealCreate).toHaveBeenCalledWith("foreign-client", SCOPE);
    for (const w of writes()) expect(w).not.toHaveBeenCalled();
  });

  it("400s on an owner who is not on the caller's org roster, and writes nothing", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue(undefined as never);
    await expect(transactionService.createTransaction({ client_id: "c1", user_id: "stranger" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.findActiveContextByUserIdInOrg).toHaveBeenCalledWith("stranger", "org1");
    for (const w of writes()) expect(w).not.toHaveBeenCalled();
  });

  it("refuses an agent or branch manager with no shop (403) on every create path, writing nothing", async () => {
    const body = { client_id: "c1", user_id: "u1" } as never;
    for (const scope of [NO_SHOP, { ...(NO_SHOP as object), orgRole: "branch_manager" } as never]) {
      await expect(transactionService.createTransaction(body, scope)).rejects.toMatchObject({ statusCode: 403 });
      await expect(transactionService.createTransactionWithEnquiry(body, { holiday_type_id: "h" } as never, scope)).rejects.toMatchObject({ statusCode: 403 });
      await expect(transactionService.createTransactionWithQuote(body, {} as never, scope)).rejects.toMatchObject({ statusCode: 403 });
      await expect(transactionService.createTransactionWithBooking(body, {} as never, scope)).rejects.toMatchObject({ statusCode: 403 });
    }
    for (const w of writes()) expect(w).not.toHaveBeenCalled();
  });

  it("update: copies only deal columns, and a client change must be a client the caller can see (404, nothing written)", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_quote", client_id: "c0", user_id: "u1", branch_id: "shop1" } as never);
    vi.mocked(transactionRepository.update).mockResolvedValue({ id: "t1" } as never);

    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1" } as never);
    await transactionService.updateTransaction("t1", { id: "x", created_at: "2001", priority: "high", client_id: "c1" } as never, SCOPE);
    expect(neonClientRepository.findById).toHaveBeenCalledWith("c1", SCOPE);
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { priority: "high", client_id: "c1" }, SCOPE);

    vi.mocked(transactionRepository.update).mockClear();
    vi.mocked(neonClientRepository.findById).mockResolvedValue(undefined as never);
    await expect(transactionService.updateTransaction("t1", { client_id: "foreign" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("BLOCKER 1: the deal lands in its OWNER's shop for admins and the system scope; agents may only create for their own shop", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchId: "shopB", branchType: "shop", orgId: "org1" } as never);
    await transactionService.createTransaction({ user_id: "agentB" } as never, ADMIN);
    expect(vi.mocked(transactionRepository.create).mock.calls[0][0]).toMatchObject({ user_id: "agentB", branch_id: "shopB" });

    vi.mocked(branchRepository.findById).mockResolvedValueOnce({ id: "shopC" } as never);
    await transactionService.createTransaction({ user_id: "agentB", branch_id: "shopC" } as never, ADMIN);
    expect(vi.mocked(transactionRepository.create).mock.calls[1][0]).toMatchObject({ branch_id: "shopC" });

    const systemScope = { orgId: "org1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: null } as never;
    await transactionService.createTransactionWithEnquiry({ user_id: "agentB" } as never, { holiday_type_id: "h" } as never, systemScope);
    expect(vi.mocked(transactionRepository.createWithEnquiryAndChildren).mock.calls[0][0].transactionData).toMatchObject({ branch_id: "shopB" });

    // An agent of shop1 handing the deal to an owner in shopB: refused, nothing written.
    vi.mocked(transactionRepository.create).mockClear();
    await expect(transactionService.createTransaction({ user_id: "agentB" } as never, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it("NIT 2: a platform admin with no organisation gets 400, not a 500", async () => {
    const platform = { orgId: "", branchId: null, orgRole: "platform_admin", orgRoles: ["platform_admin"], userId: "p" } as never;
    await expect(transactionService.createTransaction({ user_id: "u1" } as never, platform)).rejects.toMatchObject({ statusCode: 400 });
    expect(transactionRepository.create).not.toHaveBeenCalled();
  });

  it("NIT 3: empty-string client_id, lead_source and priority are treated as absent (never copied raw)", async () => {
    await transactionService.createTransaction({ client_id: "", lead_source: "", priority: "", user_id: "u1" } as never, SCOPE);
    const saved = vi.mocked(transactionRepository.create).mock.calls[0][0] as Record<string, unknown>;
    expect(saved).not.toHaveProperty("client_id");
    expect(saved).not.toHaveProperty("lead_source");
    expect(saved).not.toHaveProperty("priority");
    expect(neonClientRepository.findByIdForDealCreate).not.toHaveBeenCalled();
  });

  describe("a platform admin impersonating an organisation", () => {
    const IMPERSONATING = { orgId: "org1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "pa1", impersonating: true } as never;

    it("owns nothing there: the deal goes to the org's default owner and that owner's branch, whether user_id is themselves or blank", async () => {
      vi.mocked(branchMemberRepository.findDefaultOwner).mockResolvedValue("owner1");
      vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchId: "shopO", branchType: "shop", orgId: "org1" } as never);

      await transactionService.createTransaction({ user_id: "pa1" } as never, IMPERSONATING);
      await transactionService.createTransaction({ user_id: "" } as never, IMPERSONATING);

      expect(branchMemberRepository.findDefaultOwner).toHaveBeenCalledWith("org1");
      for (const call of vi.mocked(transactionRepository.create).mock.calls) {
        expect(call[0]).toMatchObject({ user_id: "owner1", branch_id: "shopO", org_id: "org1" });
      }
    });

    it("a requested owner who is someone else is honoured, not replaced", async () => {
      await transactionService.createTransaction({ user_id: "agentB" } as never, IMPERSONATING);
      expect(branchMemberRepository.findDefaultOwner).not.toHaveBeenCalled();
      expect(vi.mocked(transactionRepository.create).mock.calls[0][0]).toMatchObject({ user_id: "agentB" });
    });

    it("an org with no default owner is a clear 400 and nothing is written", async () => {
      vi.mocked(branchMemberRepository.findDefaultOwner).mockResolvedValue(null);
      await expect(transactionService.createTransaction({ user_id: "pa1" } as never, IMPERSONATING)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/no active members/),
      });
      expect(transactionRepository.create).not.toHaveBeenCalled();
    });

    it("a normal admin who names themselves is NOT redirected to the default owner", async () => {
      await transactionService.createTransaction({ user_id: "admin1" } as never, ADMIN);
      expect(branchMemberRepository.findDefaultOwner).not.toHaveBeenCalled();
    });
  });

  it("uses the caller's scope (not a trusted one) for the VIP/referral client lookup after a booking", async () => {
    await transactionService.createTransactionWithBooking({ client_id: "c1", user_id: "u1" } as never, {} as never, SCOPE);
    expect(neonClientRepository.findByIdForDealCreate).toHaveBeenLastCalledWith("c1", SCOPE);
  });
});

describe("transactionService.listPipelineByStatus — pinning", () => {
  it("forwards the viewing user id so the repository can sort pinned deals first", async () => {
    const page = { items: [], total: 0, page: 1, hasMore: false, totalProfit: 0, totalValue: 0 };
    vi.mocked(transactionRepository.findPipelineByStatus).mockResolvedValue(page);

    await transactionService.listPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "newest", "user-1");

    expect(transactionRepository.findPipelineByStatus).toHaveBeenCalledWith(SCOPE, "quoted", 1, 10, undefined, undefined, "newest", "user-1", undefined, undefined);
  });
});

describe("transactionService.listPipelineByStatus — filters and totals", () => {
  const FILTERS = { search: "paris", priorities: ["high" as const], quick: "no_task" as const };

  it("forwards filters to the SQL-ordered path", async () => {
    const page = { items: [], total: 0, page: 1, hasMore: false, totalProfit: 5, totalValue: 10 };
    vi.mocked(transactionRepository.findPipelineByStatus).mockResolvedValue(page);

    const res = await transactionService.listPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "value_desc", "user-1", undefined, FILTERS);

    expect(transactionRepository.findPipelineByStatus).toHaveBeenCalledWith(SCOPE, "quoted", 1, 10, undefined, undefined, "value_desc", "user-1", undefined, FILTERS);
    expect(res).toMatchObject({ totalValue: 10, totalProfit: 5 });
  });

  it("forwards filters on the oldest-activity path and returns the real totals", async () => {
    vi.mocked(transactionRepository.findPipelineCandidates).mockResolvedValue({ items: [], total: 3, totalValue: 120.5, totalProfit: 40 });

    const res = await transactionService.listPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "oldest-activity", undefined, undefined, FILTERS);

    expect(transactionRepository.findPipelineCandidates).toHaveBeenCalledWith(SCOPE, "quoted", undefined, undefined, 60, undefined, FILTERS, true);
    expect(res).toMatchObject({ total: 3, totalValue: 120.5, totalProfit: 40 });
  });
});

describe("transactionService.listPipelineByStatus — totals only on page 1", () => {
  it("asks for money totals on page 1 and not on later pages (oldest-activity path)", async () => {
    vi.mocked(transactionRepository.findPipelineCandidates).mockResolvedValue({ items: [], total: 0, totalValue: 0, totalProfit: 0 });

    await transactionService.listPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "oldest-activity");
    await transactionService.listPipelineByStatus(SCOPE, "quoted", 2, 10, undefined, undefined, "oldest-activity");

    const calls = vi.mocked(transactionRepository.findPipelineCandidates).mock.calls;
    expect(calls[calls.length - 2][7]).toBe(true);
    expect(calls[calls.length - 1][7]).toBe(false);
  });
});

describe("transactionService.getPipelineCounts", () => {
  it("sums the three open-column rows", async () => {
    vi.mocked(transactionRepository.countPipelineQuickByColumn).mockResolvedValue([
      { all: 5, due_today: 1, no_task: 2, quiet_7: 3 },
      { all: 4, due_today: 0, no_task: 1, quiet_7: 1 },
      { all: 1, due_today: 1, no_task: 0, quiet_7: 0 },
    ]);

    const res = await transactionService.getPipelineCounts(SCOPE, { agentId: "a1", search: "x" });

    expect(res).toEqual({ all: 10, due_today: 2, no_task: 3, quiet_7: 4 });
    expect(transactionRepository.countPipelineQuickByColumn).toHaveBeenCalledWith(SCOPE, "a1", undefined, { search: "x" });
  });

  it("404s a branch outside the caller's org", async () => {
    vi.mocked(branchRepository.findOrgIdById).mockResolvedValue("other-org" as never);

    await expect(transactionService.getPipelineCounts(SCOPE, { branchId: "b9" })).rejects.toMatchObject({ statusCode: 404 });
    expect(transactionRepository.countPipelineQuickByColumn).not.toHaveBeenCalled();
  });
});
