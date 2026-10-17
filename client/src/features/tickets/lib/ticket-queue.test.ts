import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyChip,
  applyFilters,
  chipCounts,
  deriveQueue,
  matchesSearch,
  scopeRows,
  sortRows,
} from "./ticket-queue";
import type { Ticket } from "../types";

const NOW = new Date("2026-10-16T10:00:00Z");
const ME = "me";

function ticket(over: Partial<Ticket> & { id: string }): Ticket {
  return {
    clientId: "c1",
    userId: ME,
    assignedTo: ME,
    type: "Sales",
    status: "Open",
    priority: "Medium",
    subject: "Subject",
    description: null,
    dueDate: null,
    createdAt: "2026-10-01T09:00:00Z",
    updatedAt: null,
    resolvedAt: null,
    ...over,
  };
}

const overdue = ticket({ id: "overdue", dueDate: "2026-10-16T07:00:00Z", priority: "High" });
const soon = ticket({ id: "soon", dueDate: "2026-10-16T11:00:00Z", status: "In Progress" });
const later = ticket({ id: "later", dueDate: "2026-10-20T11:00:00Z", priority: "Low" });
const noDue = ticket({ id: "nodue", assignedTo: null, priority: "Urgent", type: "Admin" });
const resolved = ticket({ id: "resolved", status: "Resolved", dueDate: "2026-10-01T00:00:00Z" });
const closed = ticket({ id: "closed", status: "Closed" });
const others = ticket({ id: "others", userId: "x", assignedTo: "y" });
const all = [later, noDue, resolved, overdue, closed, soon, others];

describe("scopeRows", () => {
  it("keeps only my tickets in the mine scope", () => {
    expect(scopeRows(all, "mine", ME).map((t) => t.id)).not.toContain("others");
  });
  it("leaves the other scopes to the server", () => {
    expect(scopeRows(all, "raised", ME)).toHaveLength(all.length);
    expect(scopeRows(all, "all", ME)).toHaveLength(all.length);
  });
});

describe("chipCounts and applyChip", () => {
  const mine = scopeRows(all, "mine", ME);
  it("counts open, attention, unassigned and closed over the scope", () => {
    expect(chipCounts(mine, NOW)).toEqual({ open: 4, attention: 2, unassigned: 1, closed: 2 });
  });
  it("open is Open plus In Progress", () => {
    expect(applyChip(mine, "open", NOW).map((t) => t.id).sort()).toEqual(["later", "nodue", "overdue", "soon"]);
  });
  it("attention is active and overdue or soon", () => {
    expect(applyChip(mine, "attention", NOW).map((t) => t.id).sort()).toEqual(["overdue", "soon"]);
  });
  it("unassigned is active with no assignee", () => {
    expect(applyChip(mine, "unassigned", NOW).map((t) => t.id)).toEqual(["nodue"]);
  });
  it("closed is Resolved plus Closed", () => {
    expect(applyChip(mine, "closed", NOW).map((t) => t.id).sort()).toEqual(["closed", "resolved"]);
  });
});

describe("applyFilters", () => {
  it("filters by priority and kind, and passes everything when empty", () => {
    expect(applyFilters(all, EMPTY_FILTERS)).toHaveLength(all.length);
    expect(applyFilters(all, { priorities: ["High", "Urgent"], kinds: [] }).map((t) => t.id).sort()).toEqual(["nodue", "overdue"]);
    expect(applyFilters(all, { priorities: [], kinds: ["Admin"] }).map((t) => t.id)).toEqual(["nodue"]);
    expect(applyFilters(all, { priorities: ["Urgent"], kinds: ["Sales"] })).toEqual([]);
  });
  it("counts active filters", () => {
    expect(activeFilterCount({ priorities: ["High"], kinds: ["Sales", "Admin"] })).toBe(3);
  });
});

describe("matchesSearch", () => {
  const t = ticket({
    id: "abc-123",
    subject: "Room is not sea view",
    clientName: "Mia Thompson",
    assignedToName: "Tina Love",
    clientPhone: "07700 900123",
    holiday: {
      transactionId: "t1",
      kind: "booking",
      title: "Majorca Beach Resort",
      travelDate: null,
      nights: null,
      operatorName: "Jet2holidays",
      operatorLogoUrl: null,
      haysRef: "HAYS-4411",
      supplierRef: "J2-998",
    },
  });
  it("matches across the searchable fields, case-insensitively", () => {
    for (const q of ["sea view", "mia", "abc-123", "tina", "900123", "majorca", "jet2", "hays-4411", "j2-998"]) {
      expect(matchesSearch(t, q)).toBe(true);
    }
  });
  it("matches the short id and ignores a leading hash", () => {
    const id = "1a2b3c4d-1111-2222-3333-444455556666";
    expect(matchesSearch(ticket({ id }), "#1A2B3C4D")).toBe(true);
    expect(matchesSearch(ticket({ id }), "1a2b3c4d")).toBe(true);
    expect(matchesSearch(ticket({ id }), "#zzzz")).toBe(false);
  });
  it("rejects non-matches and accepts an empty query", () => {
    expect(matchesSearch(t, "zzz")).toBe(false);
    expect(matchesSearch(t, "   ")).toBe(true);
  });
  it("ignores the literal string null client name", () => {
    expect(matchesSearch(ticket({ id: "x", clientName: "null" }), "null")).toBe(false);
  });
});

describe("sortRows", () => {
  it("sorts by due soonest with no-due tickets last", () => {
    expect(sortRows([later, noDue, overdue, soon], "due").map((t) => t.id)).toEqual(["overdue", "soon", "later", "nodue"]);
  });
  it("treats a date-only due as the end of that day", () => {
    const dayOnly = ticket({ id: "dayonly", dueDate: "2026-10-20T00:00:00Z" });
    const timed = ticket({ id: "timed", dueDate: "2026-10-20T18:00:00Z" });
    expect(sortRows([dayOnly, timed], "due").map((t) => t.id)).toEqual(["timed", "dayonly"]);
  });
  it("sorts by priority, highest first", () => {
    const med = ticket({ id: "med" });
    expect(sortRows([later, med, overdue, noDue], "priority").map((t) => t.id)).toEqual(["nodue", "overdue", "med", "later"]);
  });
  it("sorts by last activity, falling back to updated then created", () => {
    const a = ticket({ id: "a", lastActivityAt: "2026-10-10T00:00:00Z" });
    const b = ticket({ id: "b", updatedAt: "2026-10-12T00:00:00Z" });
    const c = ticket({ id: "c", createdAt: "2026-10-11T00:00:00Z" });
    expect(sortRows([a, b, c], "updated").map((t) => t.id)).toEqual(["b", "c", "a"]);
  });
  it("sorts by client name with unnamed tickets last", () => {
    const z = ticket({ id: "z", clientName: "Zoe" });
    const a = ticket({ id: "a", clientName: "Adam" });
    const none = ticket({ id: "none", clientName: null });
    expect(sortRows([none, z, a], "client").map((t) => t.id)).toEqual(["a", "z", "none"]);
  });
  it("does not mutate its input", () => {
    const input = [later, overdue];
    sortRows(input, "due");
    expect(input[0].id).toBe("later");
  });
});

describe("deriveQueue", () => {
  const base = {
    rows: all,
    scope: "mine" as const,
    userId: ME,
    chip: "open" as const,
    search: "",
    filters: EMPTY_FILTERS,
    sort: "due" as const,
    pinned: new Map<string, number>(),
    now: NOW,
  };

  it("groups the open chip into Needs attention then Open", () => {
    const result = deriveQueue(base);
    expect(result.groups.map((g) => [g.label, g.rows.map((t) => t.id)])).toEqual([
      ["Needs attention", ["overdue", "soon"]],
      ["Open", ["later", "nodue"]],
    ]);
    expect(result.orderIds).toEqual(["overdue", "soon", "later", "nodue"]);
    expect(result.counts.open).toBe(4);
  });

  it("puts pinned tickets first within each group", () => {
    const result = deriveQueue({ ...base, pinned: new Map([["nodue", 5]]) });
    expect(result.groups[1].rows.map((t) => t.id)).toEqual(["nodue", "later"]);
  });

  it("uses a single group for the other chips", () => {
    const result = deriveQueue({ ...base, chip: "closed" });
    expect(result.groups).toHaveLength(1);
    expect(result.rows.map((t) => t.id).sort()).toEqual(["closed", "resolved"]);
  });

  it("applies search and filters but keeps counts over the whole scope", () => {
    const result = deriveQueue({ ...base, search: "zzz", filters: { priorities: ["Low"], kinds: [] } });
    expect(result.orderIds).toEqual([]);
    expect(result.counts).toEqual({ open: 4, attention: 2, unassigned: 1, closed: 2 });
  });

  it("derives one due pill per scoped row", () => {
    const result = deriveQueue(base);
    expect(result.pills.get("overdue")?.tone).toBe("over");
    expect(result.pills.has("others")).toBe(false);
  });

  it("includes closed tickets for the board when asked", () => {
    const result = deriveQueue({ ...base, includeClosed: true });
    expect(result.rows.map((t) => t.id)).toContain("resolved");
    expect(result.rows.map((t) => t.id)).toContain("closed");
  });
});
