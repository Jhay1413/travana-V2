import { describe, it, expect, vi, beforeEach } from "vitest";

// Token handling in the repository: a duplicated token is never resolved to an arbitrary quote, minting checks the
// token is unused, and until the column is widened a 20 character token falls back to 12 characters.
const state = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  respond: (_text: string, _values: unknown[]): { rows: unknown[] } | Error => ({ rows: [] }),
}));

vi.mock("../../config/database", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const fakePool = {
    query: async (q: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
      const text = typeof q === "string" ? q : q.text;
      const vals = typeof q === "string" ? (values ?? []) : (q.values ?? values ?? []);
      state.queries.push({ text, values: vals });
      const answer = state.respond(text, vals);
      if (answer instanceof Error) throw answer;
      return { rows: answer.rows, rowCount: answer.rows.length, fields: [] };
    },
  };
  return { db: drizzle(fakePool as never) };
});

import { quotePublicRepository } from "./quote-public.repository";

beforeEach(() => {
  state.queries.length = 0;
  state.respond = () => ({ rows: [] });
  vi.restoreAllMocks();
});

describe("findQuoteIdByToken", () => {
  it("returns the quote id for a single match", async () => {
    state.respond = () => ({ rows: [["q1", "c1"]] });
    expect(await quotePublicRepository.findQuoteIdByToken("ABC234")).toBe("q1");
  });

  it("returns null for no match", async () => {
    expect(await quotePublicRepository.findQuoteIdByToken("ABC234")).toBeNull();
  });

  it("treats a token that matches more than one quote as not found and logs an error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.respond = () => ({ rows: [["q1", "c1"], ["q2", "c2"]] });
    expect(await quotePublicRepository.findQuoteIdByToken("ABC234")).toBeNull();
    expect(await quotePublicRepository.findTokenOwnership("ABC234")).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[0][0])).toContain("matches 2 quotes");
  });
});

describe("setToken", () => {
  const isUpdate = (text: string) => /^\s*update/i.test(text);
  const isTakenCheck = (text: string) => /select "id" from "quote_table"/i.test(text);

  it("keeps an existing token", async () => {
    state.respond = () => ({ rows: [["EXISTING1"]] });
    expect(await quotePublicRepository.setToken("q1")).toBe("EXISTING1");
    expect(state.queries.some((q) => isUpdate(q.text))).toBe(false);
  });

  it("mints a 20 character token, retrying while the token is taken, and writes it only where none is set", async () => {
    let takenChecks = 0;
    state.respond = (text, values) => {
      if (isUpdate(text)) return { rows: [[values[0]]] };
      if (isTakenCheck(text)) return { rows: ++takenChecks === 1 ? [["other"]] : [] };
      return { rows: [[null]] };
    };
    const token = await quotePublicRepository.setToken("q1");
    expect(token).toMatch(/^[A-HJ-NP-Za-km-z2-9]{20}$/);
    expect(takenChecks).toBe(2);
    const update = state.queries.find((q) => isUpdate(q.text));
    expect(update?.text).toMatch(/"quote_token" is null/i);
    expect(update?.values[0]).toBe(token);
  });

  it("falls back to a 12 character token while the column is still varchar(12)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    state.respond = (text, values) => {
      if (isUpdate(text)) {
        if (String(values[0]).length > 12) return Object.assign(new Error("value too long for type character varying(12)"), { code: "22001" });
        return { rows: [[values[0]]] };
      }
      if (isTakenCheck(text)) return { rows: [] };
      return { rows: [[null]] };
    };
    const token = await quotePublicRepository.setToken("q1");
    expect(token).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/);
  });

  it("returns the token another caller stored first when the guarded write lands on nothing", async () => {
    let selects = 0;
    state.respond = (text) => {
      if (isUpdate(text)) return { rows: [] };
      if (isTakenCheck(text)) return { rows: [] };
      return { rows: selects++ === 0 ? [[null]] : [["WINNER12345"]] };
    };
    expect(await quotePublicRepository.setToken("q1")).toBe("WINNER12345");
  });
});
