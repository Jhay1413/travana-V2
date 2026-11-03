import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("../../config/session-database", () => ({ sessionDb: { query: (...a: unknown[]) => query(...a) } }));

import { buildDeleteSessionsQuery, userSessionRepository } from "./user-session.repository";

beforeEach(() => vi.clearAllMocks());

describe("buildDeleteSessionsQuery", () => {
  it("matches both the password and the OIDC session shapes with the user id as a parameter", () => {
    const built = buildDeleteSessionsQuery("u1");
    expect(built.sql).toContain("DELETE FROM sessions");
    expect(built.sql).toContain("{passport,user,userId}");
    expect(built.sql).toContain("{passport,user,claims,sub}");
    expect(built.params).toEqual(["u1", "u1"]);
    expect(built.sql).not.toContain("u1");
  });
});

describe("userSessionRepository.deleteByUserId", () => {
  it("runs the delete on the session store database and returns the row count", async () => {
    query.mockResolvedValue({ rowCount: 3 });
    await expect(userSessionRepository.deleteByUserId("u1")).resolves.toBe(3);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][1]).toEqual(["u1", "u1"]);
  });

  it("never throws: a failing delete resolves to 0", async () => {
    query.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(userSessionRepository.deleteByUserId("u1")).resolves.toBe(0);
    spy.mockRestore();
  });
});
