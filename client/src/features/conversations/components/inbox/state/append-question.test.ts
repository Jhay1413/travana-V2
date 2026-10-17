import { describe, expect, it } from "vitest";
import { appendQuestion } from "./append-question";

describe("appendQuestion", () => {
  it("uses the question alone for an empty box", () => {
    expect(appendQuestion("", "Hi?")).toBe("Hi?");
    expect(appendQuestion("  \n", "Hi?")).toBe("Hi?");
  });
  it("adds it below existing text after a blank line", () => {
    expect(appendQuestion("Thanks for that  \n", "Hi?")).toBe("Thanks for that\n\nHi?");
  });
});
