import { beforeEach, describe, expect, it } from "vitest";
import { clearMessageSheetStore, loadMessageSheetState, messageSheetKey, saveMessageSheetState } from "./message-sheet-store";
import { EMPTY_DRAFT } from "./message-sheet";

const TOKEN_A = `header.payload.${"a".repeat(30)}`;
const TOKEN_B = `header.payload.${"b".repeat(30)}`;

beforeEach(() => clearMessageSheetStore());

describe("the Message sheet's store (a draft that follows the customer from page to page)", () => {
  const state = {
    draft: { extras: ["Airport parking"], text: "Sea view please", via: "whatsapp" as const },
    about: "quote-token:tok-1",
    thread: [{ about: "Hotel Playa", extras: "", text: "Hello", at: "today at 09:05" }],
  };

  it("hands back what was saved, as a second page's provider would find it", () => {
    const key = messageSheetKey("c1", TOKEN_A);
    saveMessageSheetState(key, state);
    expect(loadMessageSheetState(key)).toEqual(state);
  });

  it("starts empty for a customer with nothing saved", () => {
    expect(loadMessageSheetState(messageSheetKey("c1", TOKEN_A))).toEqual({ draft: EMPTY_DRAFT, about: null, thread: [] });
  });

  it("is per customer and per sign-in: another customer or a new session never sees it", () => {
    saveMessageSheetState(messageSheetKey("c1", TOKEN_A), state);
    expect(loadMessageSheetState(messageSheetKey("c2", TOKEN_A)).draft.text).toBe("");
    expect(loadMessageSheetState(messageSheetKey("c1", TOKEN_B)).draft.text).toBe("");
    expect(loadMessageSheetState(messageSheetKey(null, null)).draft.text).toBe("");
  });

  it("is forgotten on sign-out", () => {
    const key = messageSheetKey("c1", TOKEN_A);
    saveMessageSheetState(key, state);
    clearMessageSheetStore();
    expect(loadMessageSheetState(key).thread).toEqual([]);
    expect(loadMessageSheetState(key).draft.text).toBe("");
  });

  it("keeps nothing for an empty state", () => {
    const key = messageSheetKey("c1", TOKEN_A);
    saveMessageSheetState(key, state);
    saveMessageSheetState(key, { draft: EMPTY_DRAFT, about: null, thread: [] });
    expect(loadMessageSheetState(key)).toEqual({ draft: EMPTY_DRAFT, about: null, thread: [] });
  });
});
