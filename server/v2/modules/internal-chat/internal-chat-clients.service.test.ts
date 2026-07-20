import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./internal-chat-clients.repository", () => ({
  internalChatClientsRepository: {
    searchClients: vi.fn(),
    findClientById: vi.fn(),
    getClientPipelineCounts: vi.fn(),
    getClientEnquiryDetails: vi.fn(),
    getClientQuoteDetails: vi.fn(),
    getClientBookingDetails: vi.fn(),
  },
}));

import { internalChatClientsService } from "./internal-chat-clients.service";
import { internalChatClientsRepository } from "./internal-chat-clients.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org-1",
  branchId: null,
  orgRole: "org_admin",
  orgRoles: ["org_admin"],
  userId: "user-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Regression test for the "0 quotes for a client who plainly has quotes" bug:
// getClientQuoteDetails no longer excludes free/quick quotes (that filter is
// only correct for org-wide aggregate stats), so the service must thread the
// isFreeQuote flag through to the returned record instead of hiding it.
describe("internalChatClientsService.getClientRecords - quotes", () => {
  it("maps isFreeQuote through to the returned quote record", async () => {
    vi.mocked(internalChatClientsRepository.findClientById).mockResolvedValue({
      id: "client-1",
      firstName: "Ashley",
      surename: "Henderson",
      status: "active",
      createdAt: new Date(),
      assignedAgentName: null,
      orgId: "org-1",
    });
    vi.mocked(internalChatClientsRepository.getClientQuoteDetails).mockResolvedValue({
      rows: [
        {
          id: "quote-1",
          transactionId: "txn-1",
          title: null,
          quoteRef: "TRQ-2026-0002",
          quoteStatus: "primary",
          holidayTypeName: null,
          destinationName: null,
          resortName: null,
          countryName: null,
          boardBasisName: null,
          travelDate: "2026-08-01",
          numOfNights: 7,
          adult: 2,
          child: 0,
          infant: 0,
          salesPrice: "1000",
          packageCommission: "100",
          discounts: null,
          serviceCharge: null,
          pricePerPerson: "500",
          dateCreated: new Date(),
          dateExpiry: null,
          isFreeQuote: true,
        },
      ],
      truncated: false,
    });

    const result = await internalChatClientsService.getClientRecords(SCOPE, "client-1", "quotes");

    expect(result).toMatchObject({ allowed: true, found: true });
    if (result.allowed && result.found) {
      expect(result.quotes?.items[0]).toMatchObject({ id: "quote-1", isFreeQuote: true });
    }
  });
});
