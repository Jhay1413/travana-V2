import { describe, expect, it } from "vitest";
import { escapeLike } from "./escape-like";

describe("escapeLike", () => {
  it("escapes %, _ and backslash", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });

  it("leaves plain text alone", () => {
    expect(escapeLike("TUI")).toBe("TUI");
  });
});
