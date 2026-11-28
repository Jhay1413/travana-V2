import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./page-meta.repository", () => ({ pageMetaRepository: { findAccessByToken: vi.fn() } }));

import type { Request } from "express";
import { pageMetaRepository } from "./page-meta.repository";
import { renderIndexHtml } from "./page-meta.controller";
import { resetPageMetaCache } from "./page-meta.service";

const TEMPLATE = `<html><head>
    <meta property="og:title" content="Travana — The Operating System for Travel Agents" />
    <meta name="twitter:title" content="Travana" />
  </head><body></body></html>`;
const KEYS = ["PORTAL_BASE_URL", "BASE_URL", "PUBLIC_BASE_URL", "APP_URL", "REPLIT_URL", "REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN"] as const;
const saved: Record<string, string | undefined> = {};
const open = { visible: true, isBooked: false, clientDeleted: false, dateExpiry: null, agencyName: "Sunny Travel", agencyLogoUrl: null, agencySettings: {} };
const req = (hostname: string, originalUrl: string, ip = "9.9.9.9") => ({ hostname, originalUrl, ip }) as unknown as Request;

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.BASE_URL = "https://travana.app";
  vi.resetAllMocks();
  resetPageMetaCache();
  vi.mocked(pageMetaRepository.findAccessByToken).mockResolvedValue(open);
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("renderIndexHtml: single host", () => {
  it("/view-quote/<token> and /portal get the customer-facing head", async () => {
    const quote = await renderIndexHtml(TEMPLATE, req("travana.app", "/view-quote/ABCD1234?preview=0"));
    expect(quote).toContain("Sunny Travel — your holiday quote");
    expect(quote).not.toContain("Operating System");
    expect(await renderIndexHtml(TEMPLATE, req("travana.app", "/portal/login"))).toContain("Your holiday portal");
  });

  it("every other route keeps today's tags exactly", async () => {
    for (const p of ["/", "/clients", "/signup"]) {
      const html = await renderIndexHtml(TEMPLATE, req("travana.app", p));
      expect(html).toContain("The Operating System for Travel Agents");
      expect(html).not.toContain("noindex");
    }
  });
});

describe("renderIndexHtml: two hosts", () => {
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = "https://portal.travana.app";
  });

  it("the portal host gets the customer-facing head", async () => {
    const html = await renderIndexHtml(TEMPLATE, req("portal.travana.app", "/view-quote/ABCD1234"));
    expect(html).toContain("<title>Sunny Travel — your holiday quote</title>");
    expect(html).toContain("noindex");
  });

  it("an unknown token shows no agency", async () => {
    vi.mocked(pageMetaRepository.findAccessByToken).mockResolvedValue(null);
    const html = await renderIndexHtml(TEMPLATE, req("portal.travana.app", "/view-quote/ZZZZ9999"));
    expect(html).toContain("Your holiday portal");
    expect(html).not.toContain("Sunny");
  });

  it("the staff host keeps today's tags and does no lookup", async () => {
    const html = await renderIndexHtml(TEMPLATE, req("travana.app", "/view-quote/ABCD1234?preview=1"));
    expect(html).toContain("The Operating System for Travel Agents");
    expect(pageMetaRepository.findAccessByToken).not.toHaveBeenCalled();
  });

  it("a caller past 300 lookups in the window gets the neutral head and no more reads", async () => {
    for (let i = 0; i < 300; i += 1) await renderIndexHtml(TEMPLATE, req("portal.travana.app", `/view-quote/TOKEN${String(i).padStart(4, "0")}`, "7.7.7.7"));
    expect(pageMetaRepository.findAccessByToken).toHaveBeenCalledTimes(300);
    const html = await renderIndexHtml(TEMPLATE, req("portal.travana.app", "/view-quote/OVERFLOW1", "7.7.7.7"));
    expect(html).toContain("Your holiday portal");
    expect(pageMetaRepository.findAccessByToken).toHaveBeenCalledTimes(300);
  });
});
