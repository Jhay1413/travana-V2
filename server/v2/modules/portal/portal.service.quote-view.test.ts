import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../../utils/error-handler";

vi.mock("./portal.repository", () => ({ portalRepository: { findClientNameById: vi.fn() } }));
vi.mock("./portal-quotes.service", () => ({ portalQuotesService: { getReadable: vi.fn() } }));
vi.mock("../quote/quote-public.repository", () => ({
  quotePublicRepository: { logView: vi.fn() },
}));
vi.mock("../quote/quote-public.service", () => ({ quotePublicService: { notifyPortalView: vi.fn() } }));
vi.mock("../../../services/portal-chat-bridge", () => ({ bridgePortalMessageToChat: vi.fn() }));
vi.mock("../referral/referral.service", () => ({}));
vi.mock("../referral/referral-payout.service", () => ({}));
vi.mock("../referral/referral-withdrawal.service", () => ({}));
vi.mock("../wallet/wallet.service", () => ({}));
vi.mock("../tag/tag.service", () => ({}));
vi.mock("../notification/push-notification.service", () => ({}));

import { portalService } from "./portal.service";
import { portalRepository } from "./portal.repository";
import { portalQuotesService } from "./portal-quotes.service";
import { quotePublicRepository } from "../quote/quote-public.repository";
import { quotePublicService } from "../quote/quote-public.service";

const MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(portalRepository.findClientNameById).mockResolvedValue({ firstName: "Pat", lastName: "Portal" });
});

describe("logQuoteView", () => {
  it("404 for a quote the customer may not read (not theirs, not a deal of their agency, not visible), and nothing is logged", async () => {
    vi.mocked(portalQuotesService.getReadable).mockRejectedValue(new AppError("Quote not found", 404));
    await expect(portalService.logQuoteView("me", "NOPE", { userAgent: MOBILE, ipAddress: "1.2.3.4" })).rejects.toMatchObject({ statusCode: 404 });
    expect(quotePublicRepository.logView).not.toHaveBeenCalled();
  });

  it("logs the view with the viewer's name, device and browser, then notifies the agent", async () => {
    vi.mocked(portalQuotesService.getReadable).mockResolvedValue({ access: { quoteId: "q1" }, owns: true } as never);
    await portalService.logQuoteView("me", "TOK1", { userAgent: MOBILE, ipAddress: "1.2.3.4" });
    expect(quotePublicRepository.logView).toHaveBeenCalledWith("q1", {
      ipAddress: "1.2.3.4", deviceType: "mobile", browser: "Safari", userAgent: MOBILE, viewerName: "Pat Portal",
    });
    expect(quotePublicService.notifyPortalView).toHaveBeenCalledWith("TOK1", "q1", "me", "Pat Portal");
  });

  it("a same-agency customer viewing a published deal records the view too (no 403 for cached clients)", async () => {
    vi.mocked(portalQuotesService.getReadable).mockResolvedValue({ access: { quoteId: "deal1" }, owns: false } as never);
    await expect(portalService.logQuoteView("me", "DEAL1", { userAgent: MOBILE, ipAddress: "1.2.3.4" })).resolves.toBeUndefined();
    expect(quotePublicRepository.logView).toHaveBeenCalledWith("deal1", expect.objectContaining({ viewerName: "Pat Portal" }));
    expect(quotePublicService.notifyPortalView).toHaveBeenCalledWith("DEAL1", "deal1", "me", "Pat Portal");
  });
});
