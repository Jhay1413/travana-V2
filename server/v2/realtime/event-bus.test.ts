import { describe, it, expect, vi } from "vitest";
import { eventBus } from "./event-bus";
import type { RealtimeEvent } from "./realtime.types";

const EVENT: RealtimeEvent = { type: "message.received", conversationId: "conv-1" };

describe("eventBus", () => {
  it("delivers a published event only to subscribers of the same org", () => {
    const orgAHandler = vi.fn();
    const orgBHandler = vi.fn();
    const unsubA = eventBus.subscribe("org-a", orgAHandler);
    const unsubB = eventBus.subscribe("org-b", orgBHandler);

    eventBus.publish("org-a", EVENT);

    expect(orgAHandler).toHaveBeenCalledWith(EVENT);
    expect(orgBHandler).not.toHaveBeenCalled();

    unsubA();
    unsubB();
  });

  it("stops delivering events after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe("org-c", handler);

    eventBus.publish("org-c", EVENT);
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    eventBus.publish("org-c", EVENT);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not throw when publishing to an org with no subscribers", () => {
    expect(() => eventBus.publish("org-with-nobody-listening", EVENT)).not.toThrow();
  });

  it("delivers to multiple subscribers on the same org", () => {
    const handlerOne = vi.fn();
    const handlerTwo = vi.fn();
    const unsubOne = eventBus.subscribe("org-d", handlerOne);
    const unsubTwo = eventBus.subscribe("org-d", handlerTwo);

    eventBus.publish("org-d", EVENT);

    expect(handlerOne).toHaveBeenCalledTimes(1);
    expect(handlerTwo).toHaveBeenCalledTimes(1);

    unsubOne();
    unsubTwo();
  });
});
