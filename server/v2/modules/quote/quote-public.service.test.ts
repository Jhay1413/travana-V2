import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-public.repository", () => ({
  quotePublicRepository: {
    findByToken: vi.fn(),
    findNotifyInfo: vi.fn(),
    findQuoteIdByToken: vi.fn(),
    logView: vi.fn(),
    createCustomerAction: vi.fn(),
    notifyAgent: vi.fn(),
  },
}));

import { quotePublicService } from "./quote-public.service";
import { quotePublicRepository } from "./quote-public.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quotePublicService.getQuoteByToken — price math", () => {
  it("derives totalPrice and pricePerPerson from the stored figures", async () => {
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue({
      salesPrice: "1000",
      discounts: "100",
      serviceCharge: "50",
      adults: 2,
      children: 0,
    } as never);

    const result = await quotePublicService.getQuoteByToken("tok");

    expect(result.totalPrice).toBe("950.00"); // 1000 − 100 + 50
    expect(result.pricePerPerson).toBe("475.00"); // 950 / 2
  });

  it("returns 0.00 per person when there are no passengers", async () => {
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue({
      salesPrice: "1000",
      adults: 0,
      children: 0,
    } as never);

    const result = await quotePublicService.getQuoteByToken("tok");

    expect(result.pricePerPerson).toBe("0.00");
  });

  it("throws 404 for an unknown token", async () => {
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue(undefined as never);

    await expect(quotePublicService.getQuoteByToken("nope")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("quotePublicService.logView", () => {
  it("throws 404 when the token resolves to no quote", async () => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue(undefined as never);

    await expect(quotePublicService.logView("nope", {} as never)).rejects.toMatchObject({ statusCode: 404 });
    expect(quotePublicRepository.logView).not.toHaveBeenCalled();
  });
});

describe("quotePublicService notifications", () => {
  const info = (over: object) => vi.mocked(quotePublicRepository.findNotifyInfo).mockResolvedValue({ title: null, destinationName: null, clientId: "c1", clientName: null, ...over });

  it("owner view with a label links to the quote on the owner's client page", async () => {
    info({ title: "Lapland", destinationName: "Rovaniemi" });
    await quotePublicService.notifyPortalView("tok", "q1", "c1", "Jane Smith");
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1", "Quote Viewed", "Jane Smith viewed their Lapland quote via the portal", "/clients/c1?holiday=quote:q1", "quote_viewed",
    );
  });

  it("falls back to destination, then to 'their quote' with no label", async () => {
    info({ destinationName: "Rovaniemi" });
    await quotePublicService.notifyPortalView("tok", "q1", "c1", "Jane Smith");
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[2]).toBe("Jane Smith viewed their Rovaniemi quote via the portal");
    info({});
    await quotePublicService.notifyPortalView("tok", "q1", "c1", "Jane Smith");
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[2]).toBe("Jane Smith viewed their quote via the portal");
  });

  it("non-owner view says 'the' and still links to the owner's client page", async () => {
    info({ title: "Lapland", clientId: "owner" });
    await quotePublicService.notifyPortalView("tok", "q1", "bob", "Bob Jones");
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1", "Quote Viewed", "Bob Jones viewed the Lapland quote via the portal", "/clients/owner?holiday=quote:q1", "quote_viewed",
    );
  });

  it("unknown viewer name uses 'A client'; a quote with no client links to the standalone quote", async () => {
    info({ title: "Lapland", clientId: null });
    await quotePublicService.notifyPortalView("tok", "q1", null, null);
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1", "Quote Viewed", "A client viewed their Lapland quote via the portal", "/quotes/q1", "quote_viewed",
    );
  });

  it("swallows repository failures", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(quotePublicRepository.findNotifyInfo).mockRejectedValueOnce(new Error("db down"));
    await expect(quotePublicService.notifyPortalView("tok", "q1", "c1", "Jane")).resolves.toBeUndefined();
    vi.mocked(quotePublicRepository.findNotifyInfo).mockResolvedValue({ title: "x", destinationName: null, clientId: "c1", clientName: null });
    vi.mocked(quotePublicRepository.notifyAgent).mockRejectedValueOnce(new Error("insert failed"));
    await expect(quotePublicService.notifyPortalView("tok", "q1", "c1", "Jane")).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("share includes the client name and uses the quote_shared type", async () => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue("q1");
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue({ clientName: "Jane Smith", destinationName: "Rovaniemi" } as never);

    await quotePublicService.logShare("tok", "WhatsApp");

    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1", "Quote Shared!", "Jane Smith shared their Rovaniemi quote via WhatsApp", undefined, "quote_shared",
    );
  });

  it("accept and request-changes use distinct types", async () => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue("q1");
    vi.mocked(quotePublicRepository.createCustomerAction).mockResolvedValue({} as never);
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue({ destinationName: "Rovaniemi" } as never);

    await quotePublicService.handleCustomerAction("tok", "accepted", null, "Jane");
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[4]).toBe("quote_accepted");
    await quotePublicService.handleCustomerAction("tok", "changes_requested", "Cheaper", "Jane");
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[4]).toBe("quote_changes_requested");
  });
});

describe("quotePublicService.logView notifications", () => {
  const withInfo = (over: object) =>
    vi.mocked(quotePublicRepository.findNotifyInfo).mockResolvedValue({ title: null, destinationName: null, clientId: "c1", clientName: null, ...over });

  beforeEach(() => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue("q1");
    vi.mocked(quotePublicRepository.logView).mockResolvedValue({ id: "v1" } as never);
  });

  it("stores the view and notifies the agent with the client name, label and device", async () => {
    withInfo({ title: "Lapland", clientName: "Jane Smith" });
    const view = await quotePublicService.logView("tok", { deviceType: "mobile" } as never);
    expect(view).toEqual({ id: "v1" });
    expect(quotePublicRepository.logView).toHaveBeenCalledWith("q1", { deviceType: "mobile" });
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1", "Quote Viewed", "Jane Smith's Lapland quote was opened via the shared link (mobile)", "/clients/c1?holiday=quote:q1", "quote_viewed",
    );
  });

  it("omits the device when unknown and falls back to the destination", async () => {
    withInfo({ destinationName: "Rovaniemi", clientName: "Jane Smith" });
    await quotePublicService.logView("tok", {} as never);
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[2]).toBe("Jane Smith's Rovaniemi quote was opened via the shared link");
  });

  it("with no client name uses 'The <label> quote' or 'A quote', and links to the standalone quote with no client", async () => {
    withInfo({ title: "Lapland" });
    await quotePublicService.logView("tok", {} as never);
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[2]).toBe("The Lapland quote was opened via the shared link");
    withInfo({ clientId: null });
    await quotePublicService.logView("tok", {} as never);
    expect(quotePublicRepository.notifyAgent).toHaveBeenLastCalledWith(
      "q1", "Quote Viewed", "A quote was opened via the shared link", "/quotes/q1", "quote_viewed",
    );
  });

  it("still succeeds when findNotifyInfo or notifyAgent throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(quotePublicRepository.findNotifyInfo).mockRejectedValueOnce(new Error("db down"));
    await expect(quotePublicService.logView("tok", {} as never)).resolves.toEqual({ id: "v1" });
    withInfo({ title: "x" });
    vi.mocked(quotePublicRepository.notifyAgent).mockRejectedValueOnce(new Error("insert failed"));
    await expect(quotePublicService.logView("tok", {} as never)).resolves.toEqual({ id: "v1" });
    spy.mockRestore();
  });
});
