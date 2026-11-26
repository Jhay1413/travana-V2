import { describe, it, expect } from "vitest";
import { heldFor, hold } from "./scoped-state";

describe("scoped state: a hand-over or a channel pick belongs to the customer it was made for", () => {
  it("is read back for the same key", () => {
    expect(heldFor(hold("client-a", "sms"), "client-a")).toBe("sms");
  });
  it("is NOT shown for another customer: A's hand-over cannot appear while B is on screen", () => {
    const aHandOver = hold("client-a", { text: "Hi, tap https://x/portal/login?mt=SECRET" });
    expect(heldFor(aHandOver, "client-b")).toBeNull();
    // ...and it is still there if the page goes back to A (nothing was sent from B's screen).
    expect(heldFor(aHandOver, "client-a")).not.toBeNull();
  });
  it("a quote or client change in the share dialog changes the key, so nothing is carried over", () => {
    const key = (clientId: string, quoteId: string) => `${clientId}:${quoteId}`;
    const held = hold(key("c1", "q1"), "whatsapp" as const);
    expect(heldFor(held, key("c1", "q2"))).toBeNull();
    expect(heldFor(held, key("c2", "q1"))).toBeNull();
    expect(heldFor(held, key("c1", "q1"))).toBe("whatsapp");
  });
  it("nothing held reads as null", () => {
    expect(heldFor(null, "client-a")).toBeNull();
  });
});
