import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./page-meta.repository", () => ({ pageMetaRepository: { findAccessByToken: vi.fn() } }));

import { pageMetaRepository } from "./page-meta.repository";
import { NEUTRAL_DESCRIPTION, NEUTRAL_TITLE, QUOTE_DESCRIPTION, pageMetaService, resetPageMetaCache } from "./page-meta.service";

const repo = vi.mocked(pageMetaRepository);
const open = { visible: true, isBooked: false, clientDeleted: false, dateExpiry: null, agencyName: "Sunny Travel", agencyLogoUrl: "/uploads/logo.png", agencySettings: {} };
const yes = () => true;
const ask = (path: string, extra: { lookupAllowed?: () => boolean; now?: number } = {}) =>
  pageMetaService.forPath(path, { origin: "https://portal.example", lookupAllowed: yes, ...extra });
const NEUTRAL = { title: NEUTRAL_TITLE, description: NEUTRAL_DESCRIPTION, imageUrl: null };

beforeEach(() => {
  vi.resetAllMocks();
  resetPageMetaCache();
});

describe("pageMetaService.forPath", () => {
  it("a quote the public link would open: the agency name only, with the logo as an absolute address", async () => {
    repo.findAccessByToken.mockResolvedValue(open);
    expect(await ask("/view-quote/ABCD1234")).toEqual({
      title: "Sunny Travel — your holiday quote",
      description: QUOTE_DESCRIPTION,
      imageUrl: "https://portal.example/uploads/logo.png",
    });
    expect(QUOTE_DESCRIPTION).toBe("Open to see the details.");
  });

  it("nothing about the quote, its customer or the agency's contact details can be in the answer", async () => {
    repo.findAccessByToken.mockResolvedValue({ ...open, agencySettings: { profile: { phone: "01234", email: "a@b.c" } } });
    const meta = await ask("/view-quote/ABCD1234");
    expect(JSON.stringify(meta)).not.toMatch(/01234|a@b\.c/);
    expect(Object.keys(meta ?? {}).sort()).toEqual(["description", "imageUrl", "title"]);
  });

  it("booked, unavailable, deleted-client and unknown tokens get the neutral head, with no agency", async () => {
    for (const row of [{ ...open, isBooked: true }, { ...open, visible: false }, { ...open, clientDeleted: true }, null]) {
      resetPageMetaCache();
      repo.findAccessByToken.mockResolvedValue(row);
      expect(await ask("/view-quote/ABCD1234")).toEqual(NEUTRAL);
    }
  });

  it("an agency with no name gets the neutral head", async () => {
    repo.findAccessByToken.mockResolvedValue({ ...open, agencyName: "  " });
    expect(await ask("/view-quote/ABCD1234")).toEqual(NEUTRAL);
  });

  it("a logo that is not a safe address is left out", async () => {
    for (const logo of ["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.example/x.png"]) {
      resetPageMetaCache();
      repo.findAccessByToken.mockResolvedValue({ ...open, agencyLogoUrl: logo });
      expect((await ask("/view-quote/ABCD1234"))?.imageUrl).toBeNull();
    }
    resetPageMetaCache();
    repo.findAccessByToken.mockResolvedValue({ ...open, agencyLogoUrl: "https://cdn.example/logo.png" });
    expect((await ask("/view-quote/ABCD1234"))?.imageUrl).toBe("https://cdn.example/logo.png");
  });

  it("a relative logo with no origin to build it from is left out", async () => {
    repo.findAccessByToken.mockResolvedValue(open);
    expect((await pageMetaService.forPath("/view-quote/ABCD1234", { origin: "", lookupAllowed: yes }))?.imageUrl).toBeNull();
  });

  it("every portal page is neutral and needs no lookup", async () => {
    expect(await ask("/portal")).toEqual(NEUTRAL);
    expect(await ask("/portal/quote/XYZ")).toEqual(NEUTRAL);
    expect(repo.findAccessByToken).not.toHaveBeenCalled();
  });

  it("any other page keeps the app's own tags (null)", async () => {
    for (const p of ["/", "/clients", "/view-quote", "/portals", "/view-quote/a/b"]) expect(await ask(p)).toBeNull();
  });

  it("a malformed token costs no lookup", async () => {
    for (const p of ["/view-quote/ab", "/view-quote/a%20b%20c%20d", "/view-quote/%E0%A4%A", `/view-quote/${"a".repeat(65)}`]) {
      expect(await ask(p)).toEqual(NEUTRAL);
    }
    expect(repo.findAccessByToken).not.toHaveBeenCalled();
  });

  it("caches an answer for a minute (unknown tokens too), then asks again", async () => {
    repo.findAccessByToken.mockResolvedValue(null);
    await ask("/view-quote/ABCD1234", { now: 1_000 });
    await ask("/view-quote/ABCD1234", { now: 30_000 });
    expect(repo.findAccessByToken).toHaveBeenCalledTimes(1);
    await ask("/view-quote/ABCD1234", { now: 62_000 });
    expect(repo.findAccessByToken).toHaveBeenCalledTimes(2);
  });

  it("over the rate limit: the neutral head and no database read", async () => {
    expect(await ask("/view-quote/ABCD1234", { lookupAllowed: () => false })).toEqual(NEUTRAL);
    expect(repo.findAccessByToken).not.toHaveBeenCalled();
  });

  it("a failing lookup never breaks the page and is not cached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    repo.findAccessByToken.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(open);
    expect(await ask("/view-quote/ABCD1234")).toEqual(NEUTRAL);
    expect((await ask("/view-quote/ABCD1234"))?.title).toBe("Sunny Travel — your holiday quote");
  });
});
