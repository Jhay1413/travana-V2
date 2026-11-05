import { describe, it, expect } from "vitest";
import { deletedClientIds } from "./client-deleted-flag";

describe("deletedClientIds (pipeline client_deleted flag)", () => {
  it("collects only clients with deletedAt set", () => {
    const ids = deletedClientIds([
      { id: "a", deletedAt: null },
      { id: "b", deletedAt: new Date() },
      { id: "c" },
    ]);
    expect([...ids]).toEqual(["b"]);
  });
});
