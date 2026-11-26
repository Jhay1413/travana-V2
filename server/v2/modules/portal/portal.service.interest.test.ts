import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal.repository", () => ({
  DEAL_INTEREST_PREFIX: "❤️ Interested in deal: ",
  portalRepository: { hasClientInterestMessage: vi.fn(), insertClientPortalMessage: vi.fn() },
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

beforeEach(() => {
  vi.clearAllMocks();
  repo.hasClientInterestMessage.mockResolvedValue(false);
  repo.insertClientPortalMessage.mockResolvedValue(undefined);
});

describe("recordInterest", () => {
  it("the first tap messages the agent with the unchanged wording and answers alreadyTold false", async () => {
    expect(await portalService.recordInterest("me", "deal-1")).toEqual({ alreadyTold: false });
    expect(repo.hasClientInterestMessage).toHaveBeenCalledWith("me", "deal-1");
    expect(repo.insertClientPortalMessage).toHaveBeenCalledWith("me", "❤️ Interested in deal: deal-1");
    expect(bridgePortalMessageToChat).toHaveBeenCalledWith("me", "❤️ Interested in deal: deal-1", true);
  });

  it("a repeat for the same customer and deal sends nothing and answers alreadyTold true", async () => {
    repo.hasClientInterestMessage.mockResolvedValue(true);
    expect(await portalService.recordInterest("me", "deal-1")).toEqual({ alreadyTold: true });
    expect(repo.insertClientPortalMessage).not.toHaveBeenCalled();
    expect(bridgePortalMessageToChat).not.toHaveBeenCalled();
  });

  it("two taps at the same moment send one message", async () => {
    const [a, b] = await Promise.all([portalService.recordInterest("me", "deal-1"), portalService.recordInterest("me", "deal-1")]);
    expect(a).toEqual(b);
    expect(repo.insertClientPortalMessage).toHaveBeenCalledTimes(1);
  });

  it("another deal, or another customer, is a separate message", async () => {
    await portalService.recordInterest("me", "deal-1");
    await portalService.recordInterest("me", "deal-2");
    await portalService.recordInterest("you", "deal-1");
    expect(repo.insertClientPortalMessage).toHaveBeenCalledTimes(3);
  });
});
