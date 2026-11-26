import { describe, expect, it, vi } from "vitest";
import { INTEREST_NOTE_ID, INTEREST_SECTION_ID, daysLeftText, goToInterest, interestScrollBehavior } from "./quote-interest";

function fakeDoc(present: boolean) {
  const scrollIntoView = vi.fn();
  const focus = vi.fn();
  const doc = {
    getElementById: (id: string) => {
      if (!present) return null;
      if (id === INTEREST_SECTION_ID) return { scrollIntoView } as unknown as HTMLElement;
      if (id === INTEREST_NOTE_ID) return { focus } as unknown as HTMLElement;
      return null;
    },
  };
  return { doc, scrollIntoView, focus };
}

describe("goToInterest", () => {
  it("scrolls smoothly to the interest section and focuses the note field", () => {
    const { doc, scrollIntoView, focus } = fakeDoc(true);
    expect(goToInterest(doc, false)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("does not animate when reduced motion is asked for", () => {
    const { doc, scrollIntoView } = fakeDoc(true);
    goToInterest(doc, true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(interestScrollBehavior(true)).toBe("auto");
    expect(interestScrollBehavior(false)).toBe("smooth");
  });

  it("does nothing when the section is not on the page", () => {
    const { doc, focus } = fakeDoc(false);
    expect(goToInterest(doc, false)).toBe(false);
    expect(focus).not.toHaveBeenCalled();
  });
});

describe("daysLeftText", () => {
  it("has no text without a real expiry", () => {
    expect(daysLeftText(null)).toBeNull();
  });
  it("counts days, with the singular and the last day", () => {
    expect(daysLeftText(12)).toBe("12 days left");
    expect(daysLeftText(1)).toBe("1 day left");
    expect(daysLeftText(0)).toBe("Last day");
  });
});
