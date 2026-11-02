import { describe, it, expect } from "vitest";
import { updateEnquiryValidator, ENQUIRY_FORBIDDEN_KEYS } from "./enquiry.validator";
import { pickEditableEnquiryFields } from "./enquiry.types";

const ID = "11111111-1111-4111-8111-111111111111";
const parse = (body: unknown) => updateEnquiryValidator.safeParse({ params: { id: ID }, body });

describe("updateEnquiryValidator", () => {
  it("accepts the enquiry form's payload, including relation lists and non-column keys", () => {
    expect(
      parse({
        title: "Maldives",
        holiday_type_id: ID,
        travel_date: "2027-01-01",
        adults: 2,
        budget: "1200",
        flexible_nights: [7, 10],
        status: "ACTIVE",
        destinations: [ID],
        passengers: [{ type: "child", age: 4 }],
        notes: "x",
        is_test: false,
      }).success,
    ).toBe(true);
    expect(parse({ status: "LOST" }).success).toBe(true);
  });

  it.each([...ENQUIRY_FORBIDDEN_KEYS])("refuses %s", (key) => {
    const result = parse({ title: "x", [key]: key === "deleted_at" ? null : "value" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain(`${key} cannot be set`);
  });

  it("refuses a blank or null holiday type and a malformed enquiry id", () => {
    expect(parse({ holiday_type_id: "" }).success).toBe(false);
    expect(parse({ holiday_type_id: null }).success).toBe(false);
    expect(updateEnquiryValidator.safeParse({ params: { id: "nope" }, body: {} }).success).toBe(false);
  });
});

describe("pickEditableEnquiryFields", () => {
  it("keeps editable columns (including null clears) and drops everything else", () => {
    expect(pickEditableEnquiryFields({ title: "a", budget: null, transaction_id: "t", deleted_at: null, id: "i", destinations: ["d"] })).toEqual({
      title: "a",
      budget: null,
    });
  });
});
