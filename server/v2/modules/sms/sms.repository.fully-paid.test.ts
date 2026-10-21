import { describe, it, expect, beforeEach, vi } from "vitest";

const state: { rows: unknown[]; fail?: unknown } = { rows: [] };

vi.mock("../../config/database", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) chain[m] = () => chain;
  chain.limit = async () => {
    if (state.fail) throw state.fail;
    return state.rows;
  };
  return { db: chain };
});

import { smsRepository } from "./sms.repository";

beforeEach(() => {
  state.rows = [];
  state.fail = undefined;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("isBookingFullyPaid", () => {
  it("reads the flag, false when there is no row", async () => {
    state.rows = [{ fullyPaid: true }];
    expect(await smsRepository.isBookingFullyPaid("bk1")).toBe(true);
    state.rows = [];
    expect(await smsRepository.isBookingFullyPaid("bk1")).toBe(false);
  });

  it("treats a missing table (42P01, also wrapped) as not paid and warns once", async () => {
    state.fail = { code: "42P01" };
    expect(await smsRepository.isBookingFullyPaid("bk1")).toBe(false);
    state.fail = { cause: { code: "42P01" } };
    expect(await smsRepository.isBookingFullyPaid("bk1")).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("rethrows other errors", async () => {
    state.fail = new Error("boom");
    await expect(smsRepository.isBookingFullyPaid("bk1")).rejects.toThrow("boom");
  });
});
