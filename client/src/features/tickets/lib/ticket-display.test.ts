import { describe, expect, it } from "vitest";
import { cleanClientName, holidaySubLine, kindMeta, priorityMeta, shortId, statusMeta } from "./ticket-display";

describe("ticket display helpers", () => {
  it("maps kinds", () => {
    expect(kindMeta("Sales").key).toBe("Sales");
    expect(kindMeta("Admin").key).toBe("Admin");
    expect(kindMeta("Build").key).toBe("Build");
    expect(kindMeta("Whatever")).toMatchObject({ key: "other", label: "Whatever" });
  });
  it("treats Medium as the normal priority style", () => {
    expect(priorityMeta("Medium").tone).toBe("normal");
    expect(priorityMeta("Low").tone).toBe("low");
    expect(priorityMeta("High").tone).toBe("high");
    expect(priorityMeta("Urgent").tone).toBe("urgent");
  });
  it("builds status slugs for test ids", () => {
    expect(statusMeta("In Progress").slug).toBe("in-progress");
    expect(statusMeta("Open").slug).toBe("open");
    expect(statusMeta("Closed").label).toBe("Closed");
  });
  it("shortens ids", () => {
    expect(shortId("1a2b3c4d-1111-2222-3333-444455556666")).toBe("1A2B3C4D");
  });
  it("cleans the literal string null from client names", () => {
    expect(cleanClientName("null")).toBeNull();
    expect(cleanClientName("  ")).toBeNull();
    expect(cleanClientName(undefined)).toBeNull();
    expect(cleanClientName(" Mia Thompson ")).toBe("Mia Thompson");
  });
  it("builds the holiday sub line", () => {
    expect(holidaySubLine({ travelDate: "2026-06-12T00:00:00Z", nights: 7, operatorName: "TUI" })).toBe("12 Jun 2026 · 7 nights");
    expect(holidaySubLine({ travelDate: null, nights: 1, operatorName: "TUI" })).toBe("1 night");
    expect(holidaySubLine({ travelDate: null, nights: null, operatorName: "TUI" })).toBe("TUI");
    expect(holidaySubLine({ travelDate: null, nights: 0, operatorName: null })).toBeNull();
  });
});
