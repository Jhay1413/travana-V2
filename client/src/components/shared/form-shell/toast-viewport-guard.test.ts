import { describe, expect, it } from "vitest";
import { isToastViewportInteraction, isToastViewportTarget } from "./toast-viewport-guard";

const fakeEl = (inside: boolean) => ({ closest: (sel: string) => (inside && sel === "[data-toast-viewport]" ? {} : null) }) as unknown as EventTarget;

describe("isToastViewportTarget", () => {
  it("is true inside the toast viewport", () => expect(isToastViewportTarget(fakeEl(true))).toBe(true));
  it("is false for other elements", () => expect(isToastViewportTarget(fakeEl(false))).toBe(false));
  it("is false for null and targets without closest", () => {
    expect(isToastViewportTarget(null)).toBe(false);
    expect(isToastViewportTarget({} as EventTarget)).toBe(false);
  });
});

describe("isToastViewportInteraction", () => {
  const radixEvent = (target: EventTarget) => ({ detail: { originalEvent: { target } }, target: null }) as unknown as Event;
  it("reads the original event target from Radix detail", () => {
    expect(isToastViewportInteraction(radixEvent(fakeEl(true)))).toBe(true);
    expect(isToastViewportInteraction(radixEvent(fakeEl(false)))).toBe(false);
  });
});
