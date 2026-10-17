import { describe, it, expect } from "vitest";
import { listPipelineByStatusValidator, pipelineCountsValidator } from "./transaction.validator";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const parse = (query: Record<string, unknown>) =>
  listPipelineByStatusValidator.safeParse({ params: { status: "enquiry" }, query });

describe("listPipelineByStatusValidator", () => {
  it("accepts no new params (legacy callers)", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ sort: "oldest-activity" }).success).toBe(true);
  });

  it.each(["latest_activity", "value_desc", "profit_desc", "name_asc", "quiet_first"])("accepts sort %s", (sort) => {
    expect(parse({ sort }).success).toBe(true);
  });

  it("rejects an unknown sort or quick", () => {
    expect(parse({ sort: "nope" }).success).toBe(false);
    expect(parse({ quick: "nope" }).success).toBe(false);
  });

  it("accepts each quick value", () => {
    for (const quick of ["due_today", "no_task", "quiet_7"]) expect(parse({ quick }).success).toBe(true);
  });

  it("validates the search length", () => {
    expect(parse({ search: "paris" }).success).toBe(true);
    expect(parse({ search: "" }).success).toBe(true);
    expect(parse({ search: "   " }).success).toBe(true);
    expect(parse({ search: "x".repeat(101) }).success).toBe(false);
  });

  it("validates the priority CSV", () => {
    expect(parse({ priority: "low,high" }).success).toBe(true);
    expect(parse({ priority: "low,urgent" }).success).toBe(false);
    expect(parse({ priority: "low," }).success).toBe(false);
  });

  it("validates the tour operator CSV of uuids, max 50", () => {
    expect(parse({ tourOperatorId: `${UUID},${UUID}` }).success).toBe(true);
    expect(parse({ tourOperatorId: "abc" }).success).toBe(false);
    expect(parse({ tourOperatorId: Array(51).fill(UUID).join(",") }).success).toBe(false);
  });
});

describe("agentId", () => {
  it("rejects a repeated agentId (array) on both endpoints", () => {
    expect(parse({ agentId: "a" }).success).toBe(true);
    expect(parse({ agentId: ["a", "b"] }).success).toBe(false);
    expect(pipelineCountsValidator.safeParse({ query: { agentId: ["a", "b"] } }).success).toBe(false);
  });
});

describe("pipelineCountsValidator", () => {
  it("accepts the shared filter params and rejects a bad branchId", () => {
    expect(pipelineCountsValidator.safeParse({ query: { branchId: UUID, search: "x", priority: "low" } }).success).toBe(true);
    expect(pipelineCountsValidator.safeParse({ query: {} }).success).toBe(true);
    expect(pipelineCountsValidator.safeParse({ query: { branchId: "x" } }).success).toBe(false);
  });
});
