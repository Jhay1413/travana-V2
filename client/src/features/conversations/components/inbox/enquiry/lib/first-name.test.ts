import { describe, expect, it } from "vitest";
import { firstNameFor } from "./first-name";

describe("firstNameFor", () => {
  const contact = { firstName: "Sam", displayName: "Sam Jones" };
  it("prefers the linked client", () => {
    expect(firstNameFor({ firstName: " Samantha " }, contact)).toBe("Samantha");
  });
  it("falls back to the contact, then the display name, then 'them'", () => {
    expect(firstNameFor(null, contact)).toBe("Sam");
    expect(firstNameFor({ firstName: "" }, { firstName: "", displayName: "Alex Doe" })).toBe("Alex");
    expect(firstNameFor(undefined, { displayName: "" })).toBe("them");
  });
});
