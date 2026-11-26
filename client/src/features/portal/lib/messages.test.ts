import { describe, it, expect } from "vitest";
import type { PortalMessage } from "@/hooks/use-portal-api";
import { canSend, dayLabel, formatTime, groupMessagesByDay, mergeMessages } from "./messages";

const msg = (id: string, text: string, timestamp: string, sender: PortalMessage["sender"] = "client"): PortalMessage => ({ id, text, timestamp, sender });
/** Local-time dates, so the tests do not depend on the machine's time zone. */
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe("mergeMessages", () => {
  const T = (min: number) => at(2026, 11, 3, 12, min);

  it("keeps the server's messages, then sent ones the server does not have yet", () => {
    const server = [msg("1", "Hello", T(0))];
    const sent = [msg("client-2", "Any news?", T(5))];
    expect(mergeMessages(server, sent).map((m) => m.id)).toEqual(["1", "client-2"]);
  });

  it("hides a sent message once the server has its copy (same text, stamped at or after the send)", () => {
    const server = [msg("s1", "Hello", T(1))];
    expect(mergeMessages(server, [msg("client-1", "Hello", T(0))]).map((m) => m.id)).toEqual(["s1"]);
  });

  it("an old message with the same text does not hide a repeat that fails", () => {
    const server = [msg("old", "Thanks", T(0))];
    const repeat = msg("client-1", "Thanks", T(30));
    const merged = mergeMessages(server, [repeat], new Set(["client-1"]));
    expect(merged.map((m) => m.id)).toEqual(["old", "client-1"]);
  });

  it("an old message with the same text does not hide a repeat that has just succeeded (before the next poll)", () => {
    const server = [msg("old", "Thanks", T(0))];
    expect(mergeMessages(server, [msg("client-1", "Thanks", T(30))]).map((m) => m.id)).toEqual(["old", "client-1"]);
  });

  it("two identical messages in a row show two bubbles, then one each once the server has both", () => {
    const sent = [msg("client-1", "Ok", T(10)), msg("client-2", "Ok", T(11))];
    expect(mergeMessages([], sent).map((m) => m.id)).toEqual(["client-1", "client-2"]);
    expect(mergeMessages([msg("s1", "Ok", T(10))], sent).map((m) => m.id)).toEqual(["s1", "client-2"]);
    expect(mergeMessages([msg("s1", "Ok", T(10)), msg("s2", "Ok", T(11))], sent).map((m) => m.id)).toEqual(["s1", "s2"]);
  });

  it("copes with a poll that returns the messages out of order", () => {
    const server = [msg("s2", "Ok", T(11)), msg("s1", "Ok", T(10))];
    const sent = [msg("client-1", "Ok", T(10)), msg("client-2", "Ok", T(11))];
    expect(mergeMessages(server, sent).map((m) => m.id)).toEqual(["s2", "s1"]);
    expect(mergeMessages([msg("s2", "Ok", T(11))], sent).map((m) => m.id)).toEqual(["s2", "client-2"]);
  });

  it("a message still sending is shown once even when the server's copy has already arrived", () => {
    const merged = mergeMessages([msg("s1", "Hi", T(1))], [msg("client-1", "Hi", T(0))], new Set(["client-1"]));
    expect(merged.map((m) => m.id)).toEqual(["client-1"]);
  });

  it("agent messages with the same text are never taken for the customer's", () => {
    const server = [msg("a1", "Hello", T(5), "agent")];
    expect(mergeMessages(server, [msg("client-1", "Hello", T(0))]).map((m) => m.id)).toEqual(["a1", "client-1"]);
  });

  it("allows for a customer clock a few seconds behind the server's", () => {
    const sent = msg("client-1", "Hi", T(0));
    const server = [msg("s1", "Hi", new Date(new Date(T(0)).getTime() - 3000).toISOString())];
    expect(mergeMessages(server, [sent]).map((m) => m.id)).toEqual(["s1"]);
  });
});

describe("canSend", () => {
  it("needs text that is not only spaces and nothing already sending", () => {
    expect(canSend("Hello", false)).toBe(true);
    expect(canSend("   ", false)).toBe(false);
    expect(canSend("", false)).toBe(false);
    expect(canSend("Hello", true)).toBe(false);
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 10, 24, 15, 0);
  it("says Today and Yesterday, then the weekday and date", () => {
    expect(dayLabel(new Date(2026, 10, 24, 1, 0), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 10, 23, 23, 59), now)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 10, 20, 9, 0), now)).toMatch(/Fri.*20.*Nov/);
  });
  it("adds the year when it is not this year", () => {
    expect(dayLabel(new Date(2025, 11, 30, 9, 0), now)).toContain("2025");
  });
});

describe("groupMessagesByDay", () => {
  const now = new Date(2026, 10, 24, 15, 0);
  it("splits one list into a group per calendar day, keeping order", () => {
    const groups = groupMessagesByDay(
      [msg("a", "one", at(2026, 11, 22, 9)), msg("b", "two", at(2026, 11, 22, 18)), msg("c", "three", at(2026, 11, 24, 8)), msg("d", "four", at(2026, 11, 24, 9))],
      now,
    );
    expect(groups.map((g) => g.messages.map((m) => m.id))).toEqual([["a", "b"], ["c", "d"]]);
    expect(groups[1].label).toBe("Today");
  });

  it("is empty for no messages and tolerates a bad date", () => {
    expect(groupMessagesByDay([], now)).toEqual([]);
    const groups = groupMessagesByDay([msg("a", "one", at(2026, 11, 24, 8)), msg("b", "two", "not a date")], now);
    expect(groups).toHaveLength(1);
    expect(groups[0].messages).toHaveLength(2);
  });
});

describe("formatTime", () => {
  it("is empty for something that is not a date", () => {
    expect(formatTime("nope")).toBe("");
    expect(formatTime(at(2026, 11, 3, 9, 5))).toBe("09:05");
  });
});
