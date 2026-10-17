import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./quote.service", () => ({ newQuoteService: { isFreeQuote: vi.fn() } }));

import { restrictSocialManagerToFreeQuotes } from "./quote-social-guard.middleware";
import { newQuoteService } from "./quote.service";

const ID = "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11";

async function run(method: string, path: string, orgRole = "social_media_manager") {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  await restrictSocialManagerToFreeQuotes({ method, path, orgRole } as Request, res as unknown as Response, next);
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

  it("lets a missing quote fall through to the handler's 404", async () => {
    vi.mocked(newQuoteService.isFreeQuote).mockResolvedValue(null);
    expect((await run("PATCH", `/${ID}`)).next).toHaveBeenCalledOnce();
  });
});
