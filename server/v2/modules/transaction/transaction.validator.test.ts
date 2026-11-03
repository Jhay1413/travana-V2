import { describe, it, expect } from "vitest";
import { createTransactionValidator, listPipelineByStatusValidator, pipelineCountsValidator } from "./transaction.validator";

describe("createTransactionValidator", () => {
  const CLIENT = "22222222-2222-4222-8222-222222222222";
  const TYPE = "123e4567-e89b-42d3-a456-426614174000";
  const parse = (body: unknown) => createTransactionValidator.safeParse({ body });

  it("refuses an enquiry with no holiday type, an empty one, or a malformed one", () => {
    for (const enquiry of [{ title: "x" }, { holiday_type_id: "" }, { holiday_type_id: null }, { holiday_type_id: "nope" }, { holiday_type_id: 7 }]) {
      const r = parse({ client_id: CLIENT, enquiry });
      expect(r.success, JSON.stringify(enquiry)).toBe(false);
      if (!r.success) expect(r.error.errors[0].message).toBe("Enquiry requires a holiday_type_id");
    }
  });

  it("refuses an enquiry that is not an object", () => {
    expect(parse({ enquiry: "text" }).success).toBe(false);
    expect(parse({ enquiry: [1] }).success).toBe(false);
  });

  it("accepts an enquiry with a holiday type, with or without the optional fields the clients send", () => {
    expect(parse({ client_id: CLIENT, user_id: "u", enquiry: { holiday_type_id: TYPE } }).success).toBe(true);
    expect(parse({ enquiry: { holiday_type_id: TYPE, title: "", status: "ACTIVE", passengers: [{ type: "child", age: 4 }], notes: "n" } }).success).toBe(true);
  });

  it("does not touch quote, booking or bare-transaction bodies", () => {
    expect(parse({ client_id: CLIENT, quote: { travel_date: "2027-01-01" } }).success).toBe(true);
    expect(parse({ client_id: CLIENT, booking: {} }).success).toBe(true);
    expect(parse({ client_id: CLIENT, user_id: "u" }).success).toBe(true);
  });

  it("reads the multipart form's JSON `data` field the way the controller does", () => {
    expect(parse({ data: JSON.stringify({ enquiry: { holiday_type_id: TYPE } }) }).success).toBe(true);
    expect(parse({ data: JSON.stringify({ enquiry: { title: "x" } }) }).success).toBe(false);
    expect(parse({ data: JSON.stringify({ quote: { travel_date: "2027-01-01" } }) }).success).toBe(true);
  });

  it("refuses a `data` field that is not a JSON object", () => {
    expect(parse({ data: "{not json" }).success).toBe(false);
    expect(parse({ data: "[1]" }).success).toBe(false);
    expect(parse({ data: 5 }).success).toBe(false);
  });
});

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

describe("createTransactionValidator: quote and booking bodies that used to give a 500 now give a 400", () => {
  const parse = (body: unknown) => createTransactionValidator.safeParse({ body });
  const T = "11111111-1111-4111-8111-111111111111";
  const C = "22222222-2222-4222-8222-222222222222";
  const quote = (over: Record<string, unknown> = {}) => ({ client_id: C, user_id: "u", quote: { holiday_type_id: T, travel_date: "2027-06-14", ...over } });
  const booking = (over: Record<string, unknown> = {}) => ({ client_id: C, user_id: "u", booking: { holiday_type_id: T, travel_date: "2027-06-14", ...over } });
  const message = (body: unknown) => {
    const r = parse(body);
    return r.success ? null : r.error.issues[0].message;
  };

  it("accepts the shapes the real screens send (blank user_id, legacy status labels, numeric strings, lead source)", () => {
    expect(parse({ client_id: C, user_id: "", lead_source: "SHOP", is_test: false, quote: { holiday_type_id: T, travel_date: "2027-06-14", quote_status: "QUOTE_IN_PROGRESS", transfer_type: "Private Transfer", sales_price: "2400.00", package_commission: 240, discounts: "0", price_per_person: "0.00", childAges: [4, 6], transfers: [{ cost: "1" }], carHires: [], lead_source: "" } }).success).toBe(true);
    expect(parse(booking({ hays_ref: "HAY-1234567", sales_price: undefined, wallet_credit: "0", transfer_type: "none" })).success).toBe(true);
    expect(parse({ client_id: "", user_id: undefined, booking: { holiday_type_id: T, travel_date: "2027-06-14" } }).success).toBe(true);
  });

  it("refuses a non-uuid client_id or holiday_type_id", () => {
    expect(message({ client_id: "nope", quote: { holiday_type_id: T } })).toContain("client_id");
    expect(message(quote({ holiday_type_id: "nope" }))).toContain("holiday_type_id");
    expect(message(booking({ holiday_type_id: "nope" }))).toContain("holiday_type_id");
  });

  it("refuses impossible dates, out-of-enum values and non-numeric money", () => {
    expect(message(quote({ travel_date: "2026-02-30" }))).toContain("travel_date");
    expect(message(booking({ travel_date: "2026-02-30" }))).toContain("travel_date");
    expect(message(quote({ quote_status: "bogus" }))).toContain("quote_status");
    expect(message(quote({ transfer_type: "Teleport" }))).toContain("transfer_type");
    expect(message({ ...quote(), lead_source: "TELEPATHY" })).toContain("lead_source");
    expect(message({ ...quote(), priority: "urgent" })).toContain("priority");
    for (const field of ["sales_price", "package_commission", "discounts", "service_charge", "price_per_person"]) {
      expect(message(quote({ [field]: "abc" })), field).toContain(field);
    }
    expect(message(booking({ wallet_credit: "1e9x" }))).toContain("wallet_credit");
  });

  it("refuses a supplied quote or booking id, a non-array childAges and non-array transfers or carHires", () => {
    expect(message(quote({ id: T }))).toContain("id cannot be set");
    expect(message(booking({ id: T }))).toContain("id cannot be set");
    expect(message(quote({ childAges: "4,6" }))).toContain("childAges");
    expect(message(quote({ childAges: [4, "x"] }))).toContain("childAges");
    expect(message(quote({ transfers: "none" }))).toContain("transfers");
    expect(message(booking({ carHires: { a: 1 } }))).toContain("carHires");
  });
});
