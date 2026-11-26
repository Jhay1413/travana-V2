import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => ({ portalFetch: vi.fn() }));
vi.mock("@/hooks/use-portal-api", () => ({
  portalFetch: fetchMock.portalFetch,
  getPortalToken: () => null,
  clearPortalToken: vi.fn(),
  PortalApiError: class PortalApiError extends Error {},
}));

import { createPassengerMutationOptions, portalPassengerKeys, savePassportMutationOptions } from "./use-portal-passengers";

const FULL_NUMBER = "AB1234567";
const input = {
  firstName: "Jane",
  surname: "Smith",
  dateOfBirth: "1985-03-14",
  passportNumber: FULL_NUMBER,
  passportExpiry: "2032-05-01",
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

function cachedVariables(client: QueryClient): string {
  return JSON.stringify(client.getMutationCache().getAll().map((m) => m.state.variables ?? null));
}

beforeEach(() => {
  fetchMock.portalFetch.mockReset();
  fetchMock.portalFetch.mockResolvedValue({ id: "p1" });
});

describe("passport save mutations never keep the full passport number", () => {
  it("both use gcTime 0", () => {
    const client = new QueryClient();
    expect(savePassportMutationOptions(client).gcTime).toBe(0);
    expect(createPassengerMutationOptions(client).gcTime).toBe(0);
  });

  it("the save mutation is gone from the cache once its observer lets go, with no variables left", async () => {
    const client = new QueryClient();
    const observer = new MutationObserver(client, savePassportMutationOptions(client));
    await observer.mutate({ id: "p1", input });
    expect(fetchMock.portalFetch).toHaveBeenCalledTimes(1);
    observer.reset();
    await tick();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(cachedVariables(client)).not.toContain(FULL_NUMBER);
  });

  it("the create mutation is gone from the cache once settled and reset", async () => {
    const client = new QueryClient();
    const observer = new MutationObserver(client, createPassengerMutationOptions(client));
    await observer.mutate(input);
    observer.reset();
    await tick();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  it("a failed save does not leave the variables behind either", async () => {
    fetchMock.portalFetch.mockRejectedValue(new Error("nope"));
    const client = new QueryClient();
    const observer = new MutationObserver(client, savePassportMutationOptions(client));
    await observer.mutate({ id: "p1", input }).catch(() => undefined);
    observer.reset();
    await tick();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  it("success refreshes the passenger list", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const observer = new MutationObserver(client, savePassportMutationOptions(client));
    await observer.mutate({ id: "p1", input });
    expect(spy).toHaveBeenCalledWith({ queryKey: portalPassengerKeys.list });
  });
});
