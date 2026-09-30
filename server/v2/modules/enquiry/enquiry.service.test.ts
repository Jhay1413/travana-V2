import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./enquiry.repository", () => ({
  enquiryTableRepository: {
    enquiryInScope: vi.fn(),
    transactionInScope: vi.fn(),
    findById: vi.fn(),
    findByTransactionId: vi.fn(),
    findWithRelations: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    clearRelations: vi.fn(),
    addDestination: vi.fn(),
    addResort: vi.fn(),
    addAccommodation: vi.fn(),
    addBoardBasis: vi.fn(),
    addDepartureAirport: vi.fn(),
    addPassenger: vi.fn(),
  },
}));
vi.mock("../transaction/transaction.repository", () => ({
  transactionRepository: { update: vi.fn(), findById: vi.fn() },
}));

import { newEnquiryService } from "./enquiry.service";
import { enquiryTableRepository } from "./enquiry.repository";
import { transactionRepository } from "../transaction/transaction.repository";

const TRUSTED = { orgId: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enquiryTableRepository.enquiryInScope).mockResolvedValue(true as never);
  vi.mocked(enquiryTableRepository.transactionInScope).mockResolvedValue(true as never);
});

describe("newEnquiryService.createEnquiry", () => {
  it("creates an enquiry within an in-scope transaction", async () => {
    vi.mocked(enquiryTableRepository.create).mockResolvedValue({ id: "e1" } as never);

    await newEnquiryService.createEnquiry({ transaction_id: "t1" } as never, TRUSTED);

    expect(enquiryTableRepository.create).toHaveBeenCalledOnce();
  });

  it("rejects when the transaction is out of scope", async () => {
    vi.mocked(enquiryTableRepository.transactionInScope).mockResolvedValue(false as never);

    await expect(newEnquiryService.createEnquiry({ transaction_id: "t1" } as never, TRUSTED)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(enquiryTableRepository.create).not.toHaveBeenCalled();
  });
});

describe("newEnquiryService.getEnquiryById", () => {
  it("throws 404 when the enquiry does not exist", async () => {
    vi.mocked(enquiryTableRepository.findById).mockResolvedValue(undefined as never);

    await expect(newEnquiryService.getEnquiryById("e1", TRUSTED)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("newEnquiryService.updateEnquiry — status change", () => {
  it("deactivates the transaction when the enquiry is marked LOST", async () => {
    vi.mocked(enquiryTableRepository.update).mockResolvedValue({ id: "e1", transaction_id: "t1", status: "LOST" } as never);
    vi.mocked(enquiryTableRepository.findWithRelations).mockResolvedValue({ id: "e1" } as never);

    await newEnquiryService.updateEnquiry("e1", { status: "LOST" } as never, null, TRUSTED);

    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { is_active: false });
  });

  it("does not touch the transaction for a non-LOST status", async () => {
    vi.mocked(enquiryTableRepository.update).mockResolvedValue({ id: "e1", transaction_id: "t1", status: "NEW" } as never);
    vi.mocked(enquiryTableRepository.findWithRelations).mockResolvedValue({ id: "e1" } as never);

    await newEnquiryService.updateEnquiry("e1", { status: "NEW" } as never, null, TRUSTED);

    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("replaces relations: clears then re-adds destinations and passengers", async () => {
    vi.mocked(enquiryTableRepository.update).mockResolvedValue({ id: "e1", transaction_id: "t1" } as never);
    vi.mocked(enquiryTableRepository.findWithRelations).mockResolvedValue({ id: "e1" } as never);

    await newEnquiryService.updateEnquiry(
      "e1",
      {} as never,
      { destinations: ["d1", "d2"], passengers: [{ type: "child", age: 5 }] },
      TRUSTED,
    );

    expect(enquiryTableRepository.clearRelations).toHaveBeenCalledWith("e1");
    expect(enquiryTableRepository.addDestination).toHaveBeenCalledTimes(2);
    expect(enquiryTableRepository.addPassenger).toHaveBeenCalledWith("e1", "child", 5);
  });

  it("throws 404 when the enquiry to update is missing", async () => {
    vi.mocked(enquiryTableRepository.update).mockResolvedValue(undefined as never);

    await expect(newEnquiryService.updateEnquiry("e1", {} as never, null, TRUSTED)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("newEnquiryService.deleteEnquiry (soft delete)", () => {
  const SCOPE = { orgId: "o1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "u1" } as never;

  beforeEach(() => {
    vi.mocked(enquiryTableRepository.findById).mockResolvedValue({ id: "e1", transaction_id: "t1" } as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_enquiry" } as never);
  });

  it("soft-deletes (sets deleted_at via softDelete) instead of removing the row", async () => {
    await newEnquiryService.deleteEnquiry("e1", SCOPE);

    expect(enquiryTableRepository.softDelete).toHaveBeenCalledWith("e1", "u1");
  });

  it("records a null deleter for trusted (system) scope", async () => {
    await newEnquiryService.deleteEnquiry("e1", TRUSTED);
    expect(enquiryTableRepository.softDelete).toHaveBeenCalledWith("e1", null);
  });

  it("deactivates the transaction when the deal is still at the enquiry stage", async () => {
    await newEnquiryService.deleteEnquiry("e1", SCOPE);
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { is_active: false });
  });

  it("leaves a transaction that has moved on to a quote untouched", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_quote" } as never);
    await newEnquiryService.deleteEnquiry("e1", SCOPE);
    expect(enquiryTableRepository.softDelete).toHaveBeenCalled();
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("throws 404 when the enquiry is out of scope and deletes nothing", async () => {
    vi.mocked(enquiryTableRepository.enquiryInScope).mockResolvedValue(false as never);

    await expect(newEnquiryService.deleteEnquiry("e1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(enquiryTableRepository.softDelete).not.toHaveBeenCalled();
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("throws 404 for an already soft-deleted enquiry (excluded from the scope check / reads)", async () => {
    // enquiryInScope filters deleted_at IS NULL, so a deleted row reads as out of scope.
    vi.mocked(enquiryTableRepository.enquiryInScope).mockResolvedValue(false as never);
    await expect(newEnquiryService.deleteEnquiry("e1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("reads of a soft-deleted enquiry 404 (repository excludes it, service surfaces not-found)", async () => {
    vi.mocked(enquiryTableRepository.findById).mockResolvedValue(undefined as never);
    vi.mocked(enquiryTableRepository.findWithRelations).mockResolvedValue(undefined as never);
    vi.mocked(enquiryTableRepository.findByTransactionId).mockResolvedValue(undefined as never);

    await expect(newEnquiryService.getEnquiryById("e1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    await expect(newEnquiryService.getEnquiryWithRelations("e1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    await expect(newEnquiryService.getEnquiryByTransactionId("t1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });
});
