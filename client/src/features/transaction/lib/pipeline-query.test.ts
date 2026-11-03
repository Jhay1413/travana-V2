import { describe, expect, it } from "vitest";
import { appendPipelineFilterParams, normalizePipelineFilters } from "./pipeline-query";
import { transactionKeys } from "../api/use-transaction-queries";

describe("normalizePipelineFilters", () => {
  it("returns undefined for missing or empty filters", () => {
    expect(normalizePipelineFilters(undefined)).toBeUndefined();
    expect(normalizePipelineFilters({})).toBeUndefined();
    expect(normalizePipelineFilters({ search: "   ", priority: [], tourOperatorId: [" "] })).toBeUndefined();
  });

  it("trims search and drops blanks", () => {
    expect(normalizePipelineFilters({ search: "  paris " })).toEqual({ search: "paris" });
  });

  it("sorts and de-duplicates arrays", () => {
    expect(normalizePipelineFilters({ priority: ["high", "low", "high"], tourOperatorId: ["b", "a", "b"] })).toEqual({
      priority: ["high", "low"],
      tourOperatorId: ["a", "b"],
    });
  });

  it("keeps the quick filter", () => {
    expect(normalizePipelineFilters({ quick: "no_task" })).toEqual({ quick: "no_task" });
  });
});

describe("appendPipelineFilterParams", () => {
  it("appends nothing for empty filters", () => {
    const p = new URLSearchParams();
    appendPipelineFilterParams(p, {});
    expect(p.toString()).toBe("");
  });

  it("CSV-joins arrays and passes search and quick", () => {
    const p = new URLSearchParams();
    appendPipelineFilterParams(p, { search: " bob ", priority: ["medium", "low"], tourOperatorId: ["x", "y"], quick: "quiet_7" });
    expect(p.get("search")).toBe("bob");
    expect(p.get("priority")).toBe("low,medium");
    expect(p.get("tourOperatorId")).toBe("x,y");
    expect(p.get("quick")).toBe("quiet_7");
  });
});

describe("transactionKeys.pipeline", () => {
  it("keeps the legacy key when filters are empty", () => {
    const legacy = ["transactions", "pipeline", "enquiry", "agent-1", undefined, "newest", undefined];
    expect(transactionKeys.pipeline("enquiry", "agent-1", undefined, "newest", undefined)).toEqual(legacy);
    expect(transactionKeys.pipeline("enquiry", "agent-1", undefined, "newest", undefined, {})).toEqual(legacy);
    expect(transactionKeys.pipeline("enquiry", "agent-1", undefined, "newest", undefined, { search: " " })).toEqual(legacy);
  });

  it("appends normalised filters when present", () => {
    const key = transactionKeys.pipeline("quote", undefined, undefined, undefined, undefined, { priority: ["high"] });
    expect(key[key.length - 1]).toEqual({ priority: ["high"] });
    expect(key).toHaveLength(8);
  });

  it("normalises arrays in the counts key", () => {
    const a = transactionKeys.pipelineCounts({ agentId: "a", priority: ["high", "low"], search: " x " });
    const b = transactionKeys.pipelineCounts({ agentId: "a", priority: ["low", "high", "low"], search: "x" });
    expect(a).toEqual(b);
  });

  it("keeps the counts key outside the pipeline prefix", () => {
    const key = transactionKeys.pipelineCounts({ agentId: "a" });
    expect(key.slice(0, 2)).toEqual(["transactions", "pipeline-counts"]);
  });
});
