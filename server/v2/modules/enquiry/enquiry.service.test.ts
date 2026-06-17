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
    remove: vi.fn(),
    clearRelations: vi.fn(),
    addDestination: vi.fn(),
    addResort: vi.fn(),
    addBoardBasis: vi.fn(),
    addDepartureAirport: vi.fn(),
    addPassenger: vi.fn(),
  },
}));
vi.mock("../transaction/transaction.repository", () => ({
  transactionRepository: { update: vi.fn() },
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

describe("newEnquiryService.deleteEnquiry", () => {
  it("removes the enquiry after the scope check", async () => {
    await newEnquiryService.deleteEnquiry("e1", TRUSTED);
    expect(enquiryTableRepository.remove).toHaveBeenCalledWith("e1");
  });

  it("throws 404 when the enquiry is out of scope", async () => {
    vi.mocked(enquiryTableRepository.enquiryInScope).mockResolvedValue(false as never);

    await expect(newEnquiryService.deleteEnquiry("e1", TRUSTED)).rejects.toMatchObject({ statusCode: 404 });
    expect(enquiryTableRepository.remove).not.toHaveBeenCalled();
  });
});
