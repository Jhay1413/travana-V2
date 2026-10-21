import { describe, expect, it } from "vitest";
import { deriveQuoteStage, sentSummary, type QuoteStageInput } from "./quote-stage";

const NOW = new Date("2026-10-21T12:00:00Z");

function input(parts: Partial<QuoteStageInput> = {}): QuoteStageInput {
  return {
    createdAt: "2026-10-10T12:00:00Z",
    sentAt: null,
    viewCount: 0,
    lastViewedAt: null,
    customerAccepted: null,
    manualAccepted: null,
    isBooked: false,
    bookedAt: null,
    clientFirstName: "Jimmy",
    now: NOW,
    ...parts,
  };
}

const states = (i: QuoteStageInput) => deriveQuoteStage(i).steps.map((s) => s.state);

describe("deriveQuoteStage", () => {
  it("shows only Created when nothing has happened", () => {
    const stage = deriveQuoteStage(input());
    expect(states(input())).toEqual(["now", "todo", "todo", "todo", "todo"]);
    expect(stage.current).toBe("created");
    expect(stage.steps[0]!.note).toBe("10 Oct 2026");
    expect(stage.steps[1]!.note).toBe("Not yet");
    expect(stage.steps[3]!.note).toBe("Waiting for Jimmy");
    expect(stage.canMarkAccepted).toBe(true);
    expect(stage.canUndo).toBe(false);
  });

  it("moves to Sent when the quote has been sent", () => {
    const stage = deriveQuoteStage(input({ sentAt: "2026-10-11T12:00:00Z" }));
    expect(stage.current).toBe("sent");
    expect(stage.steps[1]!.note).toBe("11 Oct 2026");
    expect(stage.steps.map((s) => s.state)).toEqual(["done", "now", "todo", "todo", "todo"]);
  });

  it("notes Sent as not recorded when the quote was viewed without a sent record", () => {
    const stage = deriveQuoteStage(input({ viewCount: 3, lastViewedAt: "2026-10-21T09:00:00Z" }));
    expect(stage.current).toBe("viewed");
    expect(stage.steps[1]!.note).toBe("Not recorded");
    expect(stage.steps[1]!.state).toBe("done");
    expect(stage.steps[2]!.note).toBe("3 times, last 3 hours ago");
    expect(stage.steps[2]!.state).toBe("now");
  });

  it("drops the dangling \"last\" when the last view time is unknown", () => {
    const stage = deriveQuoteStage(input({ sentAt: "2026-10-11T12:00:00Z", viewCount: 3, lastViewedAt: null }));
    expect(stage.steps[2]!.note).toBe("3 times");
  });

  it("uses the singular for one view", () => {
    const stage = deriveQuoteStage(input({ sentAt: "2026-10-11T12:00:00Z", viewCount: 1, lastViewedAt: "2026-10-21T11:00:00Z" }));
    expect(stage.steps[2]!.note).toBe("1 time, last 1 hour ago");
  });

  it("a manual mark reads 'Marked by {first name}' and can be undone", () => {
    const stage = deriveQuoteStage(
      input({ sentAt: "2026-10-11T12:00:00Z", manualAccepted: { at: "2026-10-15T12:00:00Z", byName: "Tina Marie Smith" } }),
    );
    expect(stage.acceptedSource).toBe("manual");
    expect(stage.current).toBe("accepted");
    expect(stage.steps[3]!.note).toBe("Marked by Tina · 15 Oct 2026");
    expect(stage.canMarkAccepted).toBe(false);
    expect(stage.canUndo).toBe(true);
    expect(stage.steps[2]!.state).toBe("done");
    expect(stage.steps[2]!.note).toBe("Not recorded");
  });

  it("the customer's accept beats a manual mark and cannot be undone", () => {
    const stage = deriveQuoteStage(
      input({
        customerAccepted: { at: "2026-10-16T12:00:00Z", name: "Jimmy Bouy" },
        manualAccepted: { at: "2026-10-15T12:00:00Z", byName: "Tina" },
      }),
    );
    expect(stage.acceptedSource).toBe("customer");
    expect(stage.steps[3]!.note).toBe("By Jimmy Bouy · 16 Oct 2026");
    expect(stage.canMarkAccepted).toBe(false);
    expect(stage.canUndo).toBe(false);
  });

  it("falls back to generic names", () => {
    expect(deriveQuoteStage(input({ customerAccepted: { at: "2026-10-16T12:00:00Z", name: null } })).steps[3]!.note).toBe(
      "By the customer · 16 Oct 2026",
    );
    expect(deriveQuoteStage(input({ clientFirstName: null })).steps[3]!.note).toBe("Waiting for the customer");
  });

  it("a booked deal has every step done and no actions", () => {
    const stage = deriveQuoteStage(
      input({
        sentAt: "2026-10-11T12:00:00Z",
        manualAccepted: { at: "2026-10-15T12:00:00Z", byName: "Tina" },
        isBooked: true,
        bookedAt: "2026-10-18T12:00:00Z",
      }),
    );
    expect(stage.current).toBe("booked");
    expect(states(input({ isBooked: true }))).toEqual(["done", "done", "done", "done", "done"]);
    expect(stage.steps[4]!.note).toBe("18 Oct 2026");
    expect(stage.canMarkAccepted).toBe(false);
    expect(stage.canUndo).toBe(false);
  });

  it("a booking without a date still reads as booked", () => {
    const stage = deriveQuoteStage(input({ isBooked: true }));
    expect(stage.steps[4]!.note).toBe("Booked");
    expect(stage.steps[3]!.note).toBe("Done");
  });
});

describe("sentSummary", () => {
  it("names the date and channel", () => {
    expect(sentSummary("2026-10-12T12:00:00Z", "sms")).toBe("Sent 12 Oct 2026 by SMS");
    expect(sentSummary("2026-10-12T12:00:00Z", "link")).toBe("Sent 12 Oct 2026 by link");
    expect(sentSummary("2026-10-12T12:00:00Z", null)).toBe("Sent 12 Oct 2026");
  });
  it("is null when never sent", () => {
    expect(sentSummary(null, "sms")).toBeNull();
  });
});
