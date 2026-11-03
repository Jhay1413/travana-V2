import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  assertPublicHttpUrl: vi.fn(),
  goto: vi.fn(),
  close: vi.fn(),
}));

vi.mock("./safe-fetch-url", () => ({ assertPublicHttpUrl: mocks.assertPublicHttpUrl }));
vi.mock("../modules/easyjet/easyjet.context", () => ({ buildBrowserContext: () => ({}) }));
vi.mock("../modules/easyjet/easyjet-browser", () => ({
  withEasyJetBrowser: async (_ctx: unknown, fn: (b: unknown) => Promise<unknown>) =>
    fn({ newPage: async () => ({ goto: mocks.goto, close: mocks.close }) }),
}));

import { fetchViaHeadlessBrowser } from "./browser-fetch";

function response(opts: { status?: number; url?: string; chain?: string[]; body?: Buffer; type?: string }) {
  return {
    status: () => opts.status ?? 200,
    url: () => opts.url ?? "https://cdn.example.com/a.jpg",
    request: () => ({ redirectChain: () => (opts.chain ?? []).map((u) => ({ url: () => u })) }),
    buffer: async () => opts.body ?? Buffer.from("img"),
    headers: () => (opts.type ? { "content-type": opts.type } : {}),
  };
}

describe("fetchViaHeadlessBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertPublicHttpUrl.mockReset();
    mocks.assertPublicHttpUrl.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
  });

  it("returns the body, content type and status", async () => {
    mocks.goto.mockResolvedValue(response({ type: "image/webp" }));
    const res = await fetchViaHeadlessBrowser("https://cdn.example.com/a.jpg");
    expect(res).toEqual({ buffer: Buffer.from("img"), contentType: "image/webp", status: 200 });
    expect(mocks.close).toHaveBeenCalled();
  });

  it("returns a null content type when the header is missing", async () => {
    mocks.goto.mockResolvedValue(response({}));
    expect((await fetchViaHeadlessBrowser("https://cdn.example.com/a.jpg")).contentType).toBeNull();
  });

  it("throws on status >= 400 and still closes the page", async () => {
    mocks.goto.mockResolvedValue(response({ status: 403 }));
    await expect(fetchViaHeadlessBrowser("https://cdn.example.com/a.jpg")).rejects.toThrow(/403/);
    expect(mocks.close).toHaveBeenCalled();
  });

  it("throws when navigation yields no response", async () => {
    mocks.goto.mockResolvedValue(null);
    await expect(fetchViaHeadlessBrowser("https://cdn.example.com/a.jpg")).rejects.toThrow();
  });

  it("enforces maxBytes", async () => {
    mocks.goto.mockResolvedValue(response({ body: Buffer.alloc(100) }));
    await expect(fetchViaHeadlessBrowser("https://cdn.example.com/a.jpg", { maxBytes: 10 })).rejects.toThrow(/too large/);
    expect(mocks.close).toHaveBeenCalled();
  });

  it("closes the page when navigation throws", async () => {
    mocks.goto.mockRejectedValue(new Error("net::ERR_FAILED"));
    await expect(fetchViaHeadlessBrowser("https://cdn.example.com/a.jpg")).rejects.toThrow("net::ERR_FAILED");
    expect(mocks.close).toHaveBeenCalled();
  });

  it("rejects a redirect to a private host", async () => {
    mocks.goto.mockResolvedValue(response({ chain: ["https://cdn.example.com/a.jpg"], url: "http://10.0.0.5/x.jpg" }));
    mocks.assertPublicHttpUrl.mockImplementation(async (u: string) => {
      if (u.includes("10.0.0.5")) throw new Error("private");
    });
    await expect(fetchViaHeadlessBrowser("https://cdn.example.com/a.jpg")).rejects.toThrow("private");
    expect(mocks.close).toHaveBeenCalled();
  });

  it("runs the SSRF guard before navigating", async () => {
    mocks.assertPublicHttpUrl.mockRejectedValue(new Error("private"));
    await expect(fetchViaHeadlessBrowser("http://127.0.0.1/a.jpg")).rejects.toThrow("private");
    expect(mocks.goto).not.toHaveBeenCalled();
  });
});
