import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal.repository", () => ({
  portalRepository: {
    hasClientInterestMessage: vi.fn(),
    insertClientPortalMessage: vi.fn(),
    findClientOrg: vi.fn(),
    findDealForInterest: vi.fn(),
    findClientPortalMessages: vi.fn(),
  },
}));
vi.mock("./portal-quotes.service", () => ({ portalQuotesService: {} }));
vi.mock("../quote/quote-public.repository", () => ({ quotePublicRepository: {} }));
vi.mock("../quote/quote-public.service", () => ({ quotePublicService: {} }));
vi.mock("../../../services/portal-chat-bridge", () => ({ bridgePortalMessageToChat: vi.fn() }));
vi.mock("../referral/referral.service", () => ({}));
vi.mock("../referral/referral-payout.service", () => ({}));
vi.mock("../referral/referral-withdrawal.service", () => ({}));
vi.mock("../wallet/wallet.service", () => ({}));
vi.mock("../tag/tag.service", () => ({}));
vi.mock("../notification/push-notification.service", () => ({}));

import { portalService } from "./portal.service";
import { portalRepository } from "./portal.repository";
import { bridgePortalMessageToChat } from "../../../services/portal-chat-bridge";

const repo = vi.mocked(portalRepository);
const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  repo.hasClientInterestMessage.mockResolvedValue(false);
  repo.insertClientPortalMessage.mockResolvedValue(undefined);
  repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
  repo.findDealForInterest.mockResolvedValue({ title: "Cyprus Beach Deal", destinationName: "Paphos", countryName: "Cyprus" });
});

describe("recordInterest", () => {
  it("the first tap messages the agent with the deal's name, not its id, and answers alreadyTold false", async () => {
    expect(await portalService.recordInterest("me", D1)).toEqual({ alreadyTold: false });
    expect(repo.hasClientInterestMessage).toHaveBeenCalledWith("me", D1);
    expect(repo.findDealForInterest).toHaveBeenCalledWith("org-a", D1);
    expect(repo.insertClientPortalMessage).toHaveBeenCalledWith("me", `❤️ Interested in deal: Cyprus Beach Deal (Paphos, Cyprus) [deal:${D1}]`);
    const [clientId, text, fromDeal, display] = vi.mocked(bridgePortalMessageToChat).mock.calls[0];
    expect([clientId, text, fromDeal]).toEqual(["me", `❤️ Interested in deal: Cyprus Beach Deal (Paphos, Cyprus) [deal:${D1}]`, true]);
    expect(display?.html).toBe(`❤️ Interested in deal: <a href="/quotes/${D1}">Cyprus Beach Deal (Paphos, Cyprus)</a>`);
    expect(display?.preview).toBe("❤️ Interested in deal: Cyprus Beach Deal (Paphos, Cyprus)");
    expect(display?.html).not.toContain("[deal:");
    expect(display?.preview).not.toContain(D1);
  });

  it("a deal with no destination is named by its title alone", async () => {
    repo.findDealForInterest.mockResolvedValue({ title: "Hot Tub Break", destinationName: null, countryName: null });
    await portalService.recordInterest("me", D1);
    expect(repo.insertClientPortalMessage).toHaveBeenCalledWith("me", `❤️ Interested in deal: Hot Tub Break [deal:${D1}]`);
  });

  it("a repeat for the same customer and deal sends nothing and answers alreadyTold true (old or new stored wording)", async () => {
    repo.hasClientInterestMessage.mockResolvedValue(true);
    expect(await portalService.recordInterest("me", D1)).toEqual({ alreadyTold: true });
    expect(repo.insertClientPortalMessage).not.toHaveBeenCalled();
    expect(bridgePortalMessageToChat).not.toHaveBeenCalled();
    // A repeat does not even need the deal to be live any more.
    expect(repo.findDealForInterest).not.toHaveBeenCalled();
  });

  it("refuses a deal that is not live on the customer's own agency (another agency's, deactivated, unknown)", async () => {
    repo.findDealForInterest.mockResolvedValue(null);
    await expect(portalService.recordInterest("me", D1)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findDealForInterest).toHaveBeenCalledWith("org-a", D1);
    expect(repo.insertClientPortalMessage).not.toHaveBeenCalled();
    expect(bridgePortalMessageToChat).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a deal id without querying, and a customer with no agency", async () => {
    await expect(portalService.recordInterest("me", "deal-1")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findDealForInterest).not.toHaveBeenCalled();
    repo.findClientOrg.mockResolvedValue({ orgId: null });
    await expect(portalService.recordInterest("me", D1)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.insertClientPortalMessage).not.toHaveBeenCalled();
  });

  it("two taps at the same moment send one message", async () => {
    const [a, b] = await Promise.all([portalService.recordInterest("me", D1), portalService.recordInterest("me", D1)]);
    expect(a).toEqual(b);
    expect(repo.insertClientPortalMessage).toHaveBeenCalledTimes(1);
  });

  it("another deal, or another customer, is a separate message", async () => {
    await portalService.recordInterest("me", D1);
    await portalService.recordInterest("me", D2);
    await portalService.recordInterest("you", D1);
    expect(repo.insertClientPortalMessage).toHaveBeenCalledTimes(3);
  });
});

describe("listMessages", () => {
  it("hides the deal-id marker from the customer and leaves every other text alone", async () => {
    repo.findClientPortalMessages.mockResolvedValue([
      { id: "1", sender: "client", agentName: null, text: `❤️ Interested in deal: Cyprus Beach Deal (Paphos, Cyprus) [deal:${D1}]`, createdAt: new Date("2026-01-01") },
      { id: "2", sender: "client", agentName: null, text: `❤️ Interested in deal: ${D2}`, createdAt: new Date("2026-01-02") },
      { id: "3", sender: "client", agentName: null, text: "hello [deal:abc]", createdAt: new Date("2026-01-03") },
    ] as never);
    const out = await portalService.listMessages("me");
    expect(out.map((m) => m.text)).toEqual(["❤️ Interested in deal: Cyprus Beach Deal (Paphos, Cyprus)", `❤️ Interested in deal: ${D2}`, "hello [deal:abc]"]);
  });
});
