import { describe, expect, it } from "vitest";
import { authorBubbleClasses } from "./author-colors";

describe("authorBubbleClasses", () => {
  it("always returns sky for the current user, regardless of id", () => {
    expect(authorBubbleClasses("user-a", true).name).toBe("text-sky-700 dark:text-sky-400");
    expect(authorBubbleClasses("user-b", true)).toEqual(authorBubbleClasses("user-a", true));
  });

  it("is deterministic for a given non-me user id", () => {
    const first = authorBubbleClasses("user-123", false);
    const second = authorBubbleClasses("user-123", false);
    expect(first).toEqual(second);
  });

  it("never assigns a non-me user the sky bubble/name colours", () => {
    const ids = ["a", "bb", "ccc", "user-42", "another-user-id", "z9z9z9"];
    for (const id of ids) {
      const classes = authorBubbleClasses(id, false);
      expect(classes.name).not.toContain("sky");
      expect(classes.bubble).not.toContain("sky");
    }
  });

  it("spreads different ids across more than one palette colour", () => {
    const ids = ["alice", "bob", "carol", "dave", "erin", "frank", "gina", "heidi"];
    const names = new Set(ids.map((id) => authorBubbleClasses(id, false).name));
    expect(names.size).toBeGreaterThan(1);
  });
});
