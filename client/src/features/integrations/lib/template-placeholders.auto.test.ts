import { describe, expect, it } from "vitest";
import { defaultMapping, renderPreview, resolveMappings } from "./template-placeholders";

describe("automatic message templates", () => {
  it("map {{1}} to the client's name when there are several placeholders, and leave the rest to be mapped", () => {
    expect(defaultMapping(0, 3, "auto")).toEqual({ source: "client_first_name" });
    expect(defaultMapping(1, 3, "auto")).toEqual({ source: "custom", text: "" });
    expect(defaultMapping(2, 3, "auto")).toEqual({ source: "custom", text: "" });
  });

  it("never guess a source for a lone placeholder, and never default to the quote link", () => {
    expect(defaultMapping(0, 1, "auto")).toEqual({ source: "custom", text: "" });
    for (let i = 0; i < 4; i++) expect(defaultMapping(i, 4, "auto").source).not.toBe("quote_link");
  });

  it("keep what was saved over the defaults", () => {
    const out = resolveMappings(["1", "2"], { "2": { source: "destination" } }, "auto");
    expect(out).toEqual({ "1": { source: "client_first_name" }, "2": { source: "destination" } });
  });

  it("preview every new source with an example value", () => {
    const body = "{{1}} {{2}} {{3}} {{4}} {{5}}";
    const text = renderPreview(body, {
      "1": { source: "destination" },
      "2": { source: "booking_reference" },
      "3": { source: "departure_date" },
      "4": { source: "portal_link" },
      "5": { source: "balance_due_date" },
    });
    expect(text).not.toContain("{{");
    expect(text.split(" ").every((w) => w.length > 0)).toBe(true);
  });
});
