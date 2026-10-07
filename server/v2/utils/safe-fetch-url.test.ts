import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));

import { assertPublicHttpUrl, isPrivateAddress } from "./safe-fetch-url";

describe("isPrivateAddress", () => {
  it.each([
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "127.0.0.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.1.2.3",
    "not-an-ip",
  ])("flags %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "172.32.0.1", "172.15.0.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});

describe("assertPublicHttpUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("accepts an http(s) url that resolves to a public address", async () => {
    await expect(assertPublicHttpUrl("https://media.example.com/a.jpg")).resolves.toBeUndefined();
  });

  it("rejects non-http(s) schemes and malformed urls", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toMatchObject({ statusCode: 400 });
    await expect(assertPublicHttpUrl("ftp://example.com/a.jpg")).rejects.toMatchObject({ statusCode: 400 });
    await expect(assertPublicHttpUrl("not a url")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects literal private, loopback and metadata hosts without a DNS lookup", async () => {
    await expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data")).rejects.toMatchObject({ statusCode: 400 });
    await expect(assertPublicHttpUrl("http://127.0.0.1:5000/x")).rejects.toMatchObject({ statusCode: 400 });
    await expect(assertPublicHttpUrl("http://[::1]/x")).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to a private address (any record)", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.7", family: 4 },
    ]);
    await expect(assertPublicHttpUrl("https://evil.example.com/a.jpg")).rejects.toMatchObject({
      statusCode: 400,
      message: "Image URL points to a private address",
    });
  });

  it("maps a DNS failure to 502", async () => {
    mocks.lookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicHttpUrl("https://nope.invalid/a.jpg")).rejects.toMatchObject({ statusCode: 502 });
  });
});
