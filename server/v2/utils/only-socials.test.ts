import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const axiosGet = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({
  default: { get: axiosGet, post: vi.fn(), isAxiosError: () => false },
}));

import {
  buildPostPayload,
  clearOnlySocialsAccountsCache,
  isInstagramEnabled,
  listOnlySocialsAccounts,
  mapProviderToPlatform,
  rescheduleOnlySocialsPost,
  scheduleOnlySocialsPost,
} from "./only-socials";

const FB = { accountId: 81085, platform: "facebook" as const };
const IG = { accountId: 7, platform: "instagram" as const };

function rawAccounts() {
  return {
    data: {
      data: [
        { id: 81085, uuid: "u1", name: "Apple Travel", username: "apple", image: "i.png", provider: "facebook_page", authorized: true },
        { id: 7, uuid: "u2", name: "Apple IG", username: "appleig", image: null, provider: "instagram", authorized: false },
        { id: 3, uuid: "u3", name: "Pin", username: null, image: null, provider: "pinterest", authorized: true },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearOnlySocialsAccountsCache();
  process.env.ONLY_SOCIALS_WORKSPACE = "ws";
  process.env.ONLYSOCIAL_API_KEY = "test-key";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SOCIAL_INSTAGRAM_ENABLED;
});

describe("mapProviderToPlatform", () => {
  it.each([
    ["instagram", "instagram"],
    ["instagram_business", "instagram"],
    ["Facebook_Page", "facebook"],
    ["facebook", "facebook"],
    ["pinterest", "other"],
    ["", "other"],
    [undefined, "other"],
  ])("%s -> %s", (provider, expected) => {
    expect(mapProviderToPlatform(provider)).toBe(expected);
  });
});

describe("isInstagramEnabled", () => {
  it("is on only for the exact string true", () => {
    expect(isInstagramEnabled()).toBe(false);
    for (const v of ["1", "TRUE", "yes", ""]) {
      process.env.SOCIAL_INSTAGRAM_ENABLED = v;
      expect(isInstagramEnabled()).toBe(false);
    }
    process.env.SOCIAL_INSTAGRAM_ENABLED = "true";
    expect(isInstagramEnabled()).toBe(true);
  });
});

describe("listOnlySocialsAccounts", () => {
  it("maps the raw list and caches it (second call is a hit)", async () => {
    axiosGet.mockResolvedValue(rawAccounts());

    const first = await listOnlySocialsAccounts();
    const second = await listOnlySocialsAccounts();

    expect(axiosGet).toHaveBeenCalledTimes(1);
    expect(axiosGet.mock.calls[0][0]).toBe("https://app.onlysocial.io/os/api/ws/accounts");
    expect(second).toBe(first);
    expect(first.map((a) => [a.id, a.platform, a.authorized])).toEqual([
      [81085, "facebook", true],
      [7, "instagram", false],
      [3, "other", true],
    ]);
  });

  it("force bypasses the cache and refreshes it", async () => {
    axiosGet.mockResolvedValue(rawAccounts());
    await listOnlySocialsAccounts();
    await listOnlySocialsAccounts({ force: true });
    expect(axiosGet).toHaveBeenCalledTimes(2);
  });

  it("refetches once the 5 minute cache has expired", async () => {
    vi.useFakeTimers();
    try {
      axiosGet.mockResolvedValue(rawAccounts());
      await listOnlySocialsAccounts();
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      await listOnlySocialsAccounts();
      expect(axiosGet).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("turns an OnlySocials failure into a 502 and does not cache it", async () => {
    axiosGet.mockRejectedValueOnce(new Error("boom"));
    await expect(listOnlySocialsAccounts()).rejects.toMatchObject({ statusCode: 502, message: "Couldn't load connected accounts" });

    axiosGet.mockResolvedValue(rawAccounts());
    expect(await listOnlySocialsAccounts()).toHaveLength(3);
  });

  it("treats a malformed response as a 502", async () => {
    axiosGet.mockResolvedValue({ data: { nope: true } });
    await expect(listOnlySocialsAccounts()).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("buildPostPayload", () => {
  const base = { postContent: "hi", images: [1, 2], date: "2026-01-01", time: "10:00" };

  it("Facebook only: that account, facebook_page options", () => {
    const p = buildPostPayload({ ...base, targets: [FB] });
    expect(p.accounts).toEqual([81085]);
    expect(p.versions).toHaveLength(1);
    expect(p.versions[0]).toMatchObject({ account_id: 81085, is_original: true, options: { facebook_page: { type: "post" } } });
    expect(p.versions[0].content).toEqual([{ body: "hi", media: [1, 2], url: "" }]);
  });

  it("Instagram only: no options at all, in particular never an instagram key", () => {
    const p = buildPostPayload({ ...base, targets: [IG] });
    expect(p.accounts).toEqual([7]);
    expect(p.versions[0].options).toEqual({});
    expect(JSON.stringify(p).toLowerCase()).not.toContain("instagram");
  });

  it("both: every account, one shared version, facebook_page only, first account id on the version", () => {
    const p = buildPostPayload({ ...base, targets: [FB, IG] });
    expect(p.accounts).toEqual([81085, 7]);
    expect(p.versions).toHaveLength(1);
    expect(p.versions[0].account_id).toBe(81085);
    expect(Object.keys(p.versions[0].options)).toEqual(["facebook_page"]);
    expect(JSON.stringify(p).toLowerCase()).not.toContain("instagram");
  });

  it("refuses an empty target list", () => {
    expect(() => buildPostPayload({ ...base, targets: [] })).toThrow();
  });
});

describe("schedule / reschedule request bodies", () => {
  function stubFetch() {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "1", uuid: "uuid-1", name: "n", hexColor: "#000" }) });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("scheduleOnlySocialsPost posts the selected accounts, then confirms the schedule", async () => {
    const fetchMock = stubFetch();
    await scheduleOnlySocialsPost("2026-01-01T10:30", "hello", [4], [FB, IG]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.onlysocial.io/os/api/ws/posts");
    const body = JSON.parse((init as { body: string }).body);
    expect(body).toMatchObject({ accounts: [81085, 7], date: "2026-01-01", time: "10:30", status: "scheduled" });
    expect(body.versions[0].options).toEqual({ facebook_page: { type: "post" } });
    expect(fetchMock.mock.calls[1][0]).toBe("https://app.onlysocial.io/os/api/ws/posts/schedule/uuid-1");
  });

  it("rescheduleOnlySocialsPost PUTs the replaced accounts", async () => {
    const fetchMock = stubFetch();
    await rescheduleOnlySocialsPost("os-1", "2026-02-02T09:00", "hello", [], [IG]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.onlysocial.io/os/api/ws/posts/os-1");
    expect((init as { method: string }).method).toBe("PUT");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.accounts).toEqual([7]);
    expect(body.versions[0].options).toEqual({});
  });
});
