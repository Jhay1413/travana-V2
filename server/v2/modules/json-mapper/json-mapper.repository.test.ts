import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { db } from "../../config/database";
import { jsonMapperRepository } from "./json-mapper.repository";

// The regression under test: name lookups must try an EXACT (case-insensitive)
// match before any contains-match, and accommodations must never contains-match
// globally — that's how importing "Cala Nova" once resolved to the unrelated
// "Fiesta Cala Nova Hotel" (a different hotel, in a different resort).

vi.mock("../../config/database", () => ({ db: { select: vi.fn() } }));

const dialect = new PgDialect();

// Each db.select().from().where().limit() call records its WHERE clause and
// pops the next primed result. Serializing the clause through the pg dialect
// exposes the bound params — i.e. the actual ILIKE patterns sent to Postgres.
let whereClauses: SQL[];
let primedResults: unknown[][];

function primeDb(results: unknown[][]) {
  whereClauses = [];
  primedResults = results;
  (db.select as Mock).mockImplementation(() => ({
    from: () => ({
      where: (clause: SQL) => {
        whereClauses.push(clause);
        return { limit: async () => primedResults.shift() ?? [] };
      },
    }),
  }));
}

const paramsOf = (clause: SQL) => dialect.sqlToQuery(clause).params;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findAccommodationByName", () => {
  it("queries an exact pattern (no wildcards) first", async () => {
    primeDb([[{ id: "a1", name: "Cala Nova" }]]);
    const row = await jsonMapperRepository.findAccommodationByName("Cala Nova");
    expect(row).toEqual({ id: "a1", name: "Cala Nova" });
    expect(whereClauses).toHaveLength(1);
    expect(paramsOf(whereClauses[0])).toEqual(["Cala Nova"]);
  });

  it("does NOT fall back to a global contains-match (the Fiesta Cala Nova bug)", async () => {
    // Catalog only has "Fiesta Cala Nova Hotel" — exact match misses. The old
    // %Cala Nova% fallback would have adopted it; now the lookup must stop.
    primeDb([[]]);
    const row = await jsonMapperRepository.findAccommodationByName("Cala Nova");
    expect(row).toBeNull();
    expect(whereClauses).toHaveLength(1); // exact attempt only, no second query
  });

  it("contains-falls-back only when scoped to a resort", async () => {
    primeDb([[], [{ id: "a2", name: "Cala Nova Apartments" }]]);
    const row = await jsonMapperRepository.findAccommodationByName("Cala Nova", "resort-1");
    expect(row).toEqual({ id: "a2", name: "Cala Nova Apartments" });
    expect(whereClauses).toHaveLength(2);
    expect(paramsOf(whereClauses[0])).toEqual(["Cala Nova", "resort-1"]);
    expect(paramsOf(whereClauses[1])).toEqual(["%Cala Nova%", "resort-1"]);
  });
});

describe("exact-first ordering for the other name lookups", () => {
  it("findTourOperatorByName tries exact, then contains", async () => {
    primeDb([[], [{ id: "t1", name: "Jet2holidays" }]]);
    const row = await jsonMapperRepository.findTourOperatorByName("Jet2");
    expect(row).toEqual({ id: "t1", name: "Jet2holidays" });
    expect(paramsOf(whereClauses[0])).toEqual(["Jet2"]);
    expect(paramsOf(whereClauses[1])).toEqual(["%Jet2%"]);
  });

  it("an exact destination hit wins without running the contains query", async () => {
    primeDb([[{ id: "d1", name: "Gran Canaria" }]]);
    const row = await jsonMapperRepository.findDestinationByName("Gran Canaria", "country-1");
    expect(row).toEqual({ id: "d1", name: "Gran Canaria" });
    expect(whereClauses).toHaveLength(1);
    expect(paramsOf(whereClauses[0])).toEqual(["Gran Canaria", "country-1"]);
  });

  it("escapes ILIKE wildcard characters in names", async () => {
    primeDb([[], []]);
    await jsonMapperRepository.findRoomTypeByName("100%_Suite");
    expect(paramsOf(whereClauses[0])).toEqual(["100\\%\\_Suite"]);
    expect(paramsOf(whereClauses[1])).toEqual(["%100\\%\\_Suite%"]);
  });
});
