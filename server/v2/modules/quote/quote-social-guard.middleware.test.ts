import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./quote.service", () => ({ newQuoteService: { isFreeQuote: vi.fn(), isFreeQuoteOfChild: vi.fn() } }));

import { restrictSocialManagerToFreeQuotes } from "./quote-social-guard.middleware";
import { newQuoteService } from "./quote.service";

const ID = "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11";
const CHILD = "0a7d4c53-1b2e-4f60-8a91-3c5d7e9f1b22";

async function run(method: string, path: string, orgRole = "social_media_manager", orgId?: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  await restrictSocialManagerToFreeQuotes({ method, path, orgRole, orgId } as Request, res as unknown as Response, next);
  return { res, next };
}

beforeEach(() => vi.clearAllMocks());

describe("restrictSocialManagerToFreeQuotes", () => {
  it("lets other roles and reads straight through without a lookup", async () => {
    expect((await run("PATCH", `/${ID}`, "agent")).next).toHaveBeenCalledOnce();
    expect((await run("GET", `/${ID}`)).next).toHaveBeenCalledOnce();
    expect(newQuoteService.isFreeQuote).not.toHaveBeenCalled();
  });

  it("allows the social creation endpoints", async () => {
    expect((await run("POST", "/social-post")).next).toHaveBeenCalledOnce();
    expect((await run("POST", "/images/presign")).next).toHaveBeenCalledOnce();
  });

  it("refuses creating a deal quote and unknown write paths", async () => {
    expect((await run("POST", "/")).res.status).toHaveBeenCalledWith(403);
    expect((await run("POST", "/something")).res.status).toHaveBeenCalledWith(403);
  });

  it("allows writes to a free quote and its children", async () => {
    vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(true);
    for (const [method, path] of [["PATCH", `/${ID}`], ["DELETE", `/${ID}`], ["POST", `/${ID}/images/upload`], ["PUT", `/${ID}/tags`], ["PATCH", `/${ID}/portal-visibility`]]) {
      expect((await run(method!, path!)).next).toHaveBeenCalledOnce();
    }
  });

  it("refuses writes to a deal quote", async () => {
    vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(false);
    for (const [method, path] of [["PATCH", `/${ID}`], ["DELETE", `/${ID}`], ["POST", `/${ID}/flights`], ["POST", `/${ID}/duplicate`]]) {
      const { res, next } = await run(method!, path!);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("looks quotes up inside the caller's organisation only, so another org's quote reads as missing", async () => {
    vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(null);
    await run("PATCH", `/${ID}`, "social_media_manager", "org-1");
    expect(newQuoteService.isFreeQuote).toHaveBeenCalledWith(ID, "org-1");
    vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(true);
    vi.mocked(newQuoteService.isFreeQuoteOfChild).mockResolvedValue(true);
    await run("DELETE", `/${ID}/flights/${CHILD}`, "social_media_manager", "org-1");
    expect(newQuoteService.isFreeQuoteOfChild).toHaveBeenCalledWith("flight", CHILD, "org-1");
  });

  it("lets a missing quote fall through to the handler's 404", async () => {
    vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(null);
    expect((await run("PATCH", `/${ID}`)).next).toHaveBeenCalledOnce();
  });

  describe("child rows are judged by the quote that owns them", () => {
    const childPaths: Array<[string, string]> = [
      ["PATCH", `/${ID}/flights/${CHILD}`],
      ["DELETE", `/${ID}/flights/${CHILD}`],
      ["PATCH", `/${ID}/accommodations/${CHILD}`],
      ["DELETE", `/${ID}/accommodations/${CHILD}`],
      ["DELETE", `/${ID}/transfers/${CHILD}`],
      ["DELETE", `/${ID}/passengers/${CHILD}`],
    ];

    it("refuses a child of a deal quote even when the path names a free quote", async () => {
      vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(true); // the path's own quote is free
      vi.mocked(newQuoteService.isFreeQuoteOfChild).mockResolvedValue(false); // but the child belongs to a deal quote
      for (const [method, path] of childPaths) {
        const { res, next } = await run(method, path);
        expect(res.status, `${method} ${path}`).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      }
    });

    it("asks about the right kind and id", async () => {
      vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(true);
      vi.mocked(newQuoteService.isFreeQuoteOfChild).mockResolvedValue(true);
      await run("DELETE", `/${ID}/transfers/${CHILD}`);
      expect(newQuoteService.isFreeQuoteOfChild).toHaveBeenCalledWith("transfer", CHILD, null);
      await run("PATCH", `/${ID}/accommodations/${CHILD}`);
      expect(newQuoteService.isFreeQuoteOfChild).toHaveBeenCalledWith("accommodation", CHILD, null);
    });

    it("lets a free quote's own child through", async () => {
      vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(true);
      vi.mocked(newQuoteService.isFreeQuoteOfChild).mockResolvedValue(true);
      for (const [method, path] of childPaths) {
        expect((await run(method, path)).next, `${method} ${path}`).toHaveBeenCalledOnce();
      }
    });

    it("lets a missing child fall through to the handler's 404", async () => {
      vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(true);
      vi.mocked(newQuoteService.isFreeQuoteOfChild).mockResolvedValue(null);
      expect((await run("DELETE", `/${ID}/flights/${CHILD}`)).next).toHaveBeenCalledOnce();
    });

    it("does not look children up for other roles or for adding a child", async () => {
      expect((await run("DELETE", `/${ID}/flights/${CHILD}`, "agent")).next).toHaveBeenCalledOnce();
      vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(true);
      await run("POST", `/${ID}/flights`);
      expect(newQuoteService.isFreeQuoteOfChild).not.toHaveBeenCalled();
    });
  });
});