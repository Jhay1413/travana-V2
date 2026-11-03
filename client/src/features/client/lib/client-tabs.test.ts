import { describe, expect, it } from "vitest";
import { CLIENT_TABS, resolveClientTab } from "./client-tabs";

describe("resolveClientTab", () => {
  it("defaults to tasks", () => {
    expect(resolveClientTab("")).toBe("tasks");
    expect(resolveClientTab("?tab=nonsense")).toBe("tasks");
  });

  it("accepts every real tab", () => {
    for (const t of CLIENT_TABS) expect(resolveClientTab(`?tab=${t.value}`)).toBe(t.value);
  });

  it("maps legacy names", () => {
    expect(resolveClientTab("tab=overview")).toBe("tasks");
    expect(resolveClientTab("tab=vip-club")).toBe("club-vip");
  });
});

describe("CLIENT_TABS labels", () => {
  it("calls the VIP tab Club VIP", () => {
    expect(CLIENT_TABS.find((t) => t.value === "club-vip")?.label).toBe("Club VIP");
  });
});
