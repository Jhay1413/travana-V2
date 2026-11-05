import { describe, expect, it } from "vitest";
import { visibleTickets } from "./visible-tickets";

const rows = Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 1}` }));

describe("visibleTickets", () => {
  it("shows the first max while collapsed and counts the rest as hidden", () => {
    const r = visibleTickets(rows, false, 5, () => false);
    expect(r.shown.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    expect(r.hidden).toBe(3);
  });
  it("keeps an open ticket beyond the limit visible and out of the hidden count", () => {
    const r = visibleTickets(rows, false, 5, (id) => id === "t7");
    expect(r.shown.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5", "t7"]);
    expect(r.hidden).toBe(2);
  });
  it("shows everything when expanded", () => {
    const r = visibleTickets(rows, true, 5, () => false);
    expect(r.shown).toHaveLength(8);
    expect(r.hidden).toBe(0);
  });
});
