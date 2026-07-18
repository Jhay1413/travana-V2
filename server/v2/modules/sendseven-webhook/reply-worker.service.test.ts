import { describe, it, expect } from "vitest";
import { cleanTravellerName } from "./reply-worker.service";

// cleanTravellerName drops generic stand-ins the model may report as a
// traveller's name ("my friend", "your friend", "someone") so we never create
// a CRM client literally called "friend" — we ask for a real name instead.
describe("cleanTravellerName", () => {
  it("rejects generic references with an optional determiner", () => {
    expect(cleanTravellerName("my friend")).toBeUndefined();
    expect(cleanTravellerName("your friend")).toBeUndefined();
    expect(cleanTravellerName("the guy")).toBeUndefined();
    expect(cleanTravellerName("a mate")).toBeUndefined();
    expect(cleanTravellerName("his colleague")).toBeUndefined();
    expect(cleanTravellerName("their partner")).toBeUndefined();
    expect(cleanTravellerName("someone")).toBeUndefined();
    expect(cleanTravellerName("somebody")).toBeUndefined();
    expect(cleanTravellerName("client")).toBeUndefined();
    expect(cleanTravellerName("other half")).toBeUndefined();
    expect(cleanTravellerName("co-worker")).toBeUndefined();
    expect(cleanTravellerName("coworker")).toBeUndefined();
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(cleanTravellerName("  My Friend  ")).toBeUndefined();
    expect(cleanTravellerName("YOUR FRIEND")).toBeUndefined();
    expect(cleanTravellerName("The Guy")).toBeUndefined();
  });

  it("accepts real names", () => {
    expect(cleanTravellerName("James")).toBe("James");
    expect(cleanTravellerName("James Bond")).toBe("James Bond");
    expect(cleanTravellerName("  Maria Santos  ")).toBe("Maria Santos");
  });

  it("does not reject a real name that merely contains a generic word as part of a longer phrase", () => {
    // Only an EXACT generic phrase (with an optional single determiner) is
    // rejected — a name that happens to contain "friend" mid-string is not.
    expect(cleanTravellerName("Friendly Smith")).toBe("Friendly Smith");
    expect(cleanTravellerName("my best friend James")).toBe("my best friend James");
  });

  it("treats undefined/empty/whitespace-only input as absent", () => {
    expect(cleanTravellerName(undefined)).toBeUndefined();
    expect(cleanTravellerName("")).toBeUndefined();
    expect(cleanTravellerName("   ")).toBeUndefined();
  });
});
