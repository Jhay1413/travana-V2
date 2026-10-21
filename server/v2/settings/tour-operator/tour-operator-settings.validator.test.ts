import { describe, expect, it } from "vitest";
import {
  catalogueCreateBody,
  catalogueListQuery,
  catalogueUpdateBody,
  updateValidator,
} from "./tour-operator-settings.validator";

describe("catalogueCreateBody", () => {
  it("accepts identity fields and normalises the website", () => {
    const r = catalogueCreateBody.parse({ name: " TUI ", code: "TU", website: "tui.co.uk", phone: "0203 451 2720" });
    expect(r).toEqual({ name: "TUI", code: "TU", website: "https://tui.co.uk", phone: "0203 451 2720" });
  });

  it("strips logo_url, commission and org fields", () => {
    const r = catalogueCreateBody.parse({ name: "TUI", logo_url: "x", commission_percentage: "10", org_id: "o" });
    expect(r).toEqual({ name: "TUI" });
  });

  it("rejects a short name, long code, bad phone and bad web address", () => {
    expect(catalogueCreateBody.safeParse({ name: "T" }).success).toBe(false);
    expect(catalogueCreateBody.safeParse({ name: "TUI", code: "123456789" }).success).toBe(false);
    expect(catalogueCreateBody.safeParse({ name: "TUI", phone: "abc" }).success).toBe(false);
    expect(catalogueCreateBody.safeParse({ name: "TUI", website: "not a url" }).success).toBe(false);
  });
});

describe("catalogueUpdateBody", () => {
  it("rejects an empty body but accepts clearing a field with an empty string", () => {
    expect(catalogueUpdateBody.safeParse({}).success).toBe(false);
    expect(catalogueUpdateBody.safeParse({ logo_url: "x" }).success).toBe(false);
    expect(catalogueUpdateBody.parse({ code: "", website: "" })).toEqual({ code: "", website: "" });
  });

  it("validator wrapper needs a uuid id", () => {
    expect(updateValidator.safeParse({ params: { id: "x" }, body: { name: "TUI" } }).success).toBe(false);
    expect(
      updateValidator.safeParse({ params: { id: "11111111-1111-4111-8111-111111111111" }, body: { name: "TUI" } }).success,
    ).toBe(true);
  });
});

describe("catalogueListQuery", () => {
  it("accepts numeric page/limit strings and a search term", () => {
    expect(catalogueListQuery.safeParse({ page: "2", limit: "50", search: "tui" }).success).toBe(true);
    expect(catalogueListQuery.safeParse({ page: "x" }).success).toBe(false);
  });
});
