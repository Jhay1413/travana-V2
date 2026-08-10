import { describe, expect, it } from "vitest";
import { countMyActiveTickets, isActiveTicket, isMyTicket } from "./ticket-filters";

const ME = "user-me";
const OTHER = "user-other";

const ticket = (over: Partial<Parameters<typeof isMyTicket>[0]> = {}) => ({
  userId: OTHER,
  assignedTo: null as string | null,
  status: "Open",
  ...over,
});

describe("isActiveTicket", () => {
  it("keeps anything still to act on and drops finished work", () => {
    expect(isActiveTicket({ status: "Open" })).toBe(true);
    expect(isActiveTicket({ status: "In Progress" })).toBe(true);
    expect(isActiveTicket({ status: "Resolved" })).toBe(false);
    expect(isActiveTicket({ status: "Closed" })).toBe(false);
  });

  // The page compared exact-case, the badge lower-cased. Statuses are free text
  // in the schema, so the tolerant version is the one worth keeping.
  it("is case-insensitive", () => {
    expect(isActiveTicket({ status: "RESOLVED" })).toBe(false);
    expect(isActiveTicket({ status: "closed" })).toBe(false);
  });
});

describe("isMyTicket", () => {
  it("claims a ticket assigned to me, whoever raised it", () => {
    expect(isMyTicket(ticket({ assignedTo: ME }), ME)).toBe(true);
  });

  it("claims an unassigned ticket I raised — nobody else is going to chase it", () => {
    expect(isMyTicket(ticket({ userId: ME, assignedTo: null }), ME)).toBe(true);
  });

  it("claims one I raised and handed on ONLY once the thread is live", () => {
    const handedOn = { userId: ME, assignedTo: OTHER, status: "Open" };
    expect(isMyTicket({ ...handedOn, replyCount: 0 }, ME)).toBe(false);
    expect(isMyTicket({ ...handedOn, replyCount: 2 }, ME)).toBe(true);
  });

  it("disclaims other people's tickets, and everything when signed out", () => {
    expect(isMyTicket(ticket({ assignedTo: OTHER }), ME)).toBe(false);
    expect(isMyTicket(ticket({ assignedTo: ME }), undefined)).toBe(false);
  });
});

// The reason this module exists: the badge and the page's default view must
// report the same number. Asserted over the cases that used to diverge — the
// old badge rule (`assignedTo === me`) counts 1 of these 3.
describe("badge count agrees with the page's default Me / Active view", () => {
  const tickets = [
    { userId: OTHER, assignedTo: ME, status: "Open" }, // counted by both, old and new
    { userId: ME, assignedTo: null, status: "Open" }, // page kept it, old badge missed it
    { userId: ME, assignedTo: OTHER, status: "Open", replyCount: 3 }, // ditto
    { userId: ME, assignedTo: ME, status: "Resolved" }, // finished — neither
    { userId: OTHER, assignedTo: OTHER, status: "Open" }, // not mine — neither
  ];

  it("counts exactly the rows the page's filter keeps", () => {
    const listed = tickets.filter((t) => isMyTicket(t, ME) && isActiveTicket(t));
    expect(countMyActiveTickets(tickets, ME)).toBe(listed.length);
    expect(countMyActiveTickets(tickets, ME)).toBe(3);
  });

  it("reads zero rather than throwing before the query resolves", () => {
    expect(countMyActiveTickets(undefined, ME)).toBe(0);
    expect(countMyActiveTickets(tickets, undefined)).toBe(0);
  });
});
