import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-public.repository", () => ({
  quotePublicRepository: {
    findByToken: vi.fn(),
    findAccessState: vi.fn(),
    hasRecentLinkViewNotification: vi.fn(),
    findNotifyInfo: vi.fn(),
    findQuoteIdByToken: vi.fn(),
    logView: vi.fn(),
    createCustomerAction: vi.fn(),
    notifyAgent: vi.fn(),
  },
}));

vi.mock("../portal/portal-branding.repository", () => ({ portalBrandingRepository: {} }));

import { quotePublicService } from "./quote-public.service";
import { quotePublicRepository } from "./quote-public.repository";

const OPEN = { visible: true, isBooked: false, clientDeleted: false, dateExpiry: null, agencyName: null, agencyLogoUrl: null, agencySettings: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(quotePublicRepository.findAccessState).mockResolvedValue(OPEN);
  vi.mocked(quotePublicRepository.hasRecentLinkViewNotification).mockResolvedValue(false);
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
    vi.mocked(quotePublicRepository.findNotifyInfo).mockResolvedValue({ title: null, clientId: "c1", clientName: "Jane Smith", destinationName: "Rovaniemi" });

    await quotePublicService.logShare("ABC234", "WhatsApp");

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

describe("quotePublicService.handleCustomerAction: portal decisions", () => {
  beforeEach(() => {
    vi.mocked(quotePublicRepository.findQuoteIdByToken).mockResolvedValue("q1");
    vi.mocked(quotePublicRepository.createCustomerAction).mockResolvedValue({} as never);
    vi.mocked(quotePublicRepository.findByToken).mockResolvedValue({ destinationName: "Rovaniemi" } as never);
  });

  it("an accept keeps its exact record shape and wording (no new keys when there are no details)", async () => {
    await quotePublicService.handleCustomerAction("tok", "accepted", "Sea view", "Jane");
    expect(quotePublicRepository.createCustomerAction).toHaveBeenCalledWith({ quoteId: "q1", actionType: "accepted", message: "Sea view", customerName: "Jane" });
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1", "Quote Accepted!", "Jane wants to book on the Rovaniemi quote: \"Sea view\"", undefined, "quote_accepted",
    );
  });

  it("a decline stores the reason and the similar flag and tells the agent why", async () => {
    await quotePublicService.handleCustomerAction("tok", "declined", "Too far north", "Jane", { reason: "Wrong destination", wantsSimilar: true });
    expect(quotePublicRepository.createCustomerAction).toHaveBeenCalledWith({
      quoteId: "q1", actionType: "declined", message: "Too far north", customerName: "Jane", reason: "Wrong destination", wantsSimilar: true,
    });
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1",
      "Quote Declined",
      "Jane is not interested in the Rovaniemi quote (Wrong destination): \"Too far north\". They would like something similar.",
      undefined,
      "quote_declined",
    );
  });

  it("a decline with no reason or note and no wish for something similar reads plainly", async () => {
    await quotePublicService.handleCustomerAction("tok", "declined", null, null, { reason: null, wantsSimilar: false });
    expect(quotePublicRepository.createCustomerAction).toHaveBeenCalledWith({ quoteId: "q1", actionType: "declined", message: null, customerName: null, wantsSimilar: false });
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[2]).toBe("A customer is not interested in the Rovaniemi quote.");
  });

  it("an undo of a decline is recorded and the agent is told", async () => {
    await quotePublicService.handleCustomerAction("tok", "reopened", null, "Jane");
    expect(quotePublicRepository.createCustomerAction).toHaveBeenCalledWith({ quoteId: "q1", actionType: "reopened", message: null, customerName: "Jane" });
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1", "Quote Reopened", "Jane has reopened the Rovaniemi quote, so it is undecided again", undefined, "quote_reopened",
    );
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
    const view = await quotePublicService.logView("ABC234", { deviceType: "mobile" } as never);
    expect(view).toEqual({ id: "v1" });
    expect(quotePublicRepository.logView).toHaveBeenCalledWith("q1", { deviceType: "mobile" });
    expect(quotePublicRepository.notifyAgent).toHaveBeenCalledWith(
      "q1", "Quote Viewed", "Jane Smith's Lapland quote was opened via the shared link (mobile)", "/clients/c1?holiday=quote:q1", "quote_viewed",
    );
  });

  it("omits the device when unknown and falls back to the destination", async () => {
    withInfo({ destinationName: "Rovaniemi", clientName: "Jane Smith" });
    await quotePublicService.logView("ABC234", {} as never);
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[2]).toBe("Jane Smith's Rovaniemi quote was opened via the shared link");
  });

  it("with no client name uses 'The <label> quote' or 'A quote', and links to the standalone quote with no client", async () => {
    withInfo({ title: "Lapland" });
    await quotePublicService.logView("ABC234", {} as never);
    expect(vi.mocked(quotePublicRepository.notifyAgent).mock.calls.at(-1)?.[2]).toBe("The Lapland quote was opened via the shared link");
    withInfo({ clientId: null });
    await quotePublicService.logView("ABC234", {} as never);
    expect(quotePublicRepository.notifyAgent).toHaveBeenLastCalledWith(
      "q1", "Quote Viewed", "A quote was opened via the shared link", "/quotes/q1", "quote_viewed",
    );
  });

  it("still succeeds when findNotifyInfo or notifyAgent throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(quotePublicRepository.findNotifyInfo).mockRejectedValueOnce(new Error("db down"));
    await expect(quotePublicService.logView("ABC234", {} as never)).resolves.toEqual({ id: "v1" });
    withInfo({ title: "x" });
    vi.mocked(quotePublicRepository.notifyAgent).mockRejectedValueOnce(new Error("insert failed"));
    await expect(quotePublicService.logView("ABC234", {} as never)).resolves.toEqual({ id: "v1" });
    spy.mockRestore();
  });
});
