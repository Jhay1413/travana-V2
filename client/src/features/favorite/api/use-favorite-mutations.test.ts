import { MutationObserver, QueryClient } from "@tanstack/query-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Favorite } from "./favorite.api";
import { favoriteKeys } from "./use-favorite-queries";

const toggle = vi.hoisted(() => vi.fn());
vi.mock("./favorite.api", () => ({ favoriteApi: { toggle } }));
vi.mock("@/features/transaction/api/use-transaction-queries", () => ({ transactionKeys: { all: ["transactions"] } }));

import { toggleFavoriteMutationOptions } from "./use-favorite-mutations";

const payload = { itemType: "ticket", itemId: "t1", label: "Subject", subtitle: "Sales" };
const pinned: Favorite = {
  id: "f1", userId: "u1", itemType: "ticket", itemId: "t1", label: "Subject", subtitle: "Sales", displayOrder: 0, createdAt: new Date().toISOString(),
};

/** Fires the real pin-toggle mutation and returns the cached favourites right after onMutate ran. */
async function fire(qc: QueryClient) {
  const observer = new MutationObserver(qc, toggleFavoriteMutationOptions(qc));
  const done = observer.mutate(payload).catch(() => undefined);
  // onMutate is async (cancelQueries); let it settle before the network promise does.
  await new Promise((r) => setTimeout(r, 0));
  const duringFlight = qc.getQueryData<Favorite[]>(favoriteKeys.all);
  return { duringFlight, done };
}

describe("toggleFavoriteMutationOptions (ticket pin)", () => {
  let qc: QueryClient;
  beforeEach(() => {
    toggle.mockReset();
    qc = new QueryClient();
  });

  it("pinning flips the cache exactly once (adds one entry)", async () => {
    qc.setQueryData<Favorite[]>(favoriteKeys.all, []);
    let release: (v: unknown) => void = () => undefined;
    toggle.mockReturnValue(new Promise((r) => (release = r)));
    const { duringFlight, done } = await fire(qc);
    expect(duringFlight?.filter((f) => f.itemId === "t1")).toHaveLength(1);
    release({ favorited: true });
    await done;
  });

  it("unpinning flips the cache exactly once (removes the entry)", async () => {
    qc.setQueryData<Favorite[]>(favoriteKeys.all, [pinned]);
    let release: (v: unknown) => void = () => undefined;
    toggle.mockReturnValue(new Promise((r) => (release = r)));
    const { duringFlight, done } = await fire(qc);
    expect(duringFlight).toEqual([]);
    release({ favorited: false });
    await done;
  });

  it("rolls the cache back to the previous list when the request fails", async () => {
    qc.setQueryData<Favorite[]>(favoriteKeys.all, [pinned]);
    toggle.mockRejectedValue(new Error("boom"));
    const { done } = await fire(qc);
    await done;
    // onSettled invalidates (no fetcher registered), the rolled-back data stays.
    expect(qc.getQueryData<Favorite[]>(favoriteKeys.all)).toEqual([pinned]);
  });
});
