import { describe, expect, it } from "vitest";
import { timezoneLabel } from "./timezone-label";

describe("timezoneLabel", () => {
  it("shortens London to UK time", () => {
    expect(timezoneLabel("Europe/London")).toBe("UK time");
  });

  it("passes other zones through", () => {
    expect(timezoneLabel("America/New_York")).toBe("America/New_York");
  });
});
