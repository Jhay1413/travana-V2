import { describe, it, expect } from "vitest";
import { cleanTravellerName } from "./internal-chat-testflow.service";

// internal-chat-testflow re-exports the SHARED cleanTravellerName (it used to
// carry a duplicate, which drifted). This asserts the re-export still works;
// the behaviour itself is covered in ai-auto-reply-scenarios.test.ts.
// Previously:
// reply-worker.service's (kept separate so the internal-chat module doesn't
// depend on the sendseven-webhook module) — locking in the same behavior here
// so the two can't silently drift.
describe("cleanTravellerName (re-exported from the shared brain)", () => {
  it("rejects generic references with an optional determiner", () => {
    expect(cleanTravellerName("my friend")).toBeUndefined();
    expect(cleanTravellerName("your friend")).toBeUndefined();
    expect(cleanTravellerName("the guy")).toBeUndefined();
    expect(cleanTravellerName("someone")).toBeUndefined();
  });

  it("accepts real names", () => {
    expect(cleanTravellerName("James")).toBe("James");
    expect(cleanTravellerName("James Bond")).toBe("James Bond");
  });

  it("treats undefined/empty/whitespace-only input as absent", () => {
    expect(cleanTravellerName(undefined)).toBeUndefined();
    expect(cleanTravellerName("")).toBeUndefined();
    expect(cleanTravellerName("   ")).toBeUndefined();
  });
});
