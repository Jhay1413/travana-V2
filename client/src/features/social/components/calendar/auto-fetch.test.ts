import { describe, expect, it } from "vitest";
import { shouldAutoFetchNext } from "./auto-fetch";

const base = { hasNextPage: true, isFetchingNextPage: false, isFetchNextPageError: false, pagesLoaded: 1 };

describe("shouldAutoFetchNext", () => {
  it("fetches while more pages exist", () => {
    expect(shouldAutoFetchNext(base)).toBe(true);
  });

  it("stops when there is nothing more, a fetch is running, or the last fetch failed", () => {
    expect(shouldAutoFetchNext({ ...base, hasNextPage: false })).toBe(false);
    expect(shouldAutoFetchNext({ ...base, isFetchingNextPage: true })).toBe(false);
    expect(shouldAutoFetchNext({ ...base, isFetchNextPageError: true })).toBe(false);
  });

  it("stops at the page cap", () => {
    expect(shouldAutoFetchNext({ ...base, pagesLoaded: 3 }, 3)).toBe(false);
    expect(shouldAutoFetchNext({ ...base, pagesLoaded: 2 }, 3)).toBe(true);
  });
});
