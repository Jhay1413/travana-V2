import { describe, expect, it } from "vitest";
import type { EnquiryTable } from "@/features/quote/types";
import type { QuoteDisplay } from "@/features/quote/components/quote-types";
import { FIELD_ICONS } from "./holiday-field-icons";
import {
  buildEnquiryFields,
  buildQuoteLikeFields,
  formatBudgetType,
  formatQuotePassengers,
  showTransferPill,
  joinNames,
  type FieldRowSpec,
} from "./holiday-fields";

function quote(over: Record<string, unknown> = {}): QuoteDisplay {
  return {
    travelDate: "2026-09-12",
    accommodation: { property: "Hotel Sol", roomType: "Sea view", board: "All Inclusive", notes: "" },
    transferType: "",
    flights: { outbound: { from: "Gatwick (LGW)" } },
    commissions: { tourOperator: "TUI" },
    passengers: { adults: 2, children: 1, childAges: [5] },
    passengersInfants: 1,
    nights: 7,
    leadSource: "GOOGLE_ADS",
    ...over,
  } as unknown as QuoteDisplay;
}

const flat = (f: { left: FieldRowSpec[]; right: FieldRowSpec[] }) => [...f.left, ...f.right];
const byKey = (rows: FieldRowSpec[], key: string) => rows.find((r) => r.key === key);

describe("formatQuotePassengers", () => {
  it("lists adults, children and infants with plurals", () => {
    expect(formatQuotePassengers(quote())).toBe("2 Adults, 1 Child, 1 Infant");
  });

  it("returns null when nobody is travelling", () => {
    expect(formatQuotePassengers(quote({ passengers: { adults: 0, children: 0, childAges: [] }, passengersInfants: 0 }))).toBeNull();
  });
});

describe("formatQuotePassengers child ages", () => {
  const withAges = (childAges: Array<number | null>, children = 2) => quote({ passengers: { adults: 2, children, childAges } });
  it("shows ages after the children count when asked", () => {
    expect(formatQuotePassengers(withAges([5, 8]), { withAges: true })).toBe("2 Adults, 2 Children (5, 8), 1 Infant");
  });
  it("skips null ages and omits the bracket when all are 0 or missing", () => {
    expect(formatQuotePassengers(withAges([null, 7]), { withAges: true })).toBe("2 Adults, 2 Children (7), 1 Infant");
    expect(formatQuotePassengers(withAges([0, 0]), { withAges: true })).toBe("2 Adults, 2 Children, 1 Infant");
    expect(formatQuotePassengers(withAges([]), { withAges: true })).toBe("2 Adults, 2 Children, 1 Infant");
  });
  it("keeps a real 0 alongside other ages", () => {
    expect(formatQuotePassengers(withAges([0, 6]), { withAges: true })).toBe("2 Adults, 2 Children (0, 6), 1 Infant");
  });
  it("drops ages beyond the number of children", () => {
    expect(formatQuotePassengers(withAges([5, 8, 11], 2), { withAges: true })).toBe("2 Adults, 2 Children (5, 8), 1 Infant");
    expect(formatQuotePassengers(withAges([5, 8], 1), { withAges: true })).toBe("2 Adults, 1 Child (5), 1 Infant");
  });
  it("leaves the plain form (hero) unchanged", () => {
    expect(formatQuotePassengers(withAges([5, 8]))).toBe("2 Adults, 2 Children, 1 Infant");
  });
  it("appears in the Holiday details row", () => {
    const rows = flat(buildQuoteLikeFields(quote({ packageType: "Package", passengers: { adults: 2, children: 1, childAges: [5] } })));
    expect(byKey(rows, "no-passengers")?.value).toBe("2 Adults, 1 Child (5), 1 Infant");
  });
});

describe("buildQuoteLikeFields", () => {
  it("shows only the eight package holiday facts, in order (no tour operator or lead source)", () => {
    const rows = flat(buildQuoteLikeFields(quote({ packageType: "Package Holiday" })));
    expect(rows.map((r) => r.key)).toEqual([
      "travel-date", "departure-airport", "hotel", "board-basis",
      "room-type", "no-nights", "no-passengers", "transfer-type",
    ]);
    expect(byKey(rows, "hotel")).toMatchObject({ icon: "hotel", label: "Hotel", value: "Hotel Sol" });
    expect(byKey(rows, "travel-date")?.value).toBe("12/09/2026");
    expect(byKey(rows, "no-nights")?.value).toBe("7 nights");
    expect(byKey(rows, "no-passengers")?.value).toBe("2 Adults, 1 Child (5), 1 Infant");
  });

  it("keeps the full set, incl. tour operator and lead source, for hot tub and cruise", () => {
    for (const packageType of ["Hot Tub Break", "Cruise Package"]) {
      const rows = flat(buildQuoteLikeFields(quote({ packageType })));
      expect(rows.map((r) => r.key)).toEqual([
        "travel-date", "hotel", "room-type", "board-basis", "transfer-type",
        "departure-airport", "tour-operator", "no-passengers", "no-nights", "lead-source",
      ]);
      expect(byKey(rows, "lead-source")?.value).toBe("Google Ads");
    }
  });

  it("defaults the transfer type and nulls missing values", () => {
    const rows = flat(buildQuoteLikeFields(quote({ accommodation: { property: "", roomType: "", board: "" }, travelDate: "" })));
    expect(byKey(rows, "transfer-type")?.value).toBe("Private Transfer");
    expect(byKey(rows, "hotel")?.value).toBeNull();
    expect(byKey(rows, "travel-date")?.value).toBeNull();
  });

  it("keeps a stored None transfer type visible in the labelled row", () => {
    const rows = flat(buildQuoteLikeFields(quote({ packageType: "Package", transferType: "None" })));
    expect(byKey(rows, "transfer-type")?.value).toBe("None");
  });

  it("uses a singular night label", () => {
    expect(byKey(flat(buildQuoteLikeFields(quote({ nights: 1 }))), "no-nights")?.value).toBe("1 night");
  });

  it("only uses icon keys that have a lucide mapping", () => {
    for (const row of flat(buildQuoteLikeFields(quote()))) expect(FIELD_ICONS[row.icon]).toBeDefined();
  });
});

describe("joinNames", () => {
  it("joins the truthy names and returns null when none", () => {
    expect(joinNames(["Spain", null, undefined, "Portugal"])).toBe("Spain, Portugal");
    expect(joinNames([null])).toBeNull();
    expect(joinNames(undefined)).toBeNull();
  });
});

describe("formatBudgetType", () => {
  it("maps PER_PERSON to pp, other types to a lower-case suffix and empty to nothing", () => {
    expect(formatBudgetType("PER_PERSON")).toBe("pp");
    expect(formatBudgetType("TOTAL")).toBe(" total");
    expect(formatBudgetType(null)).toBe("");
  });
});

function enquiry(over: Record<string, unknown> = {}): EnquiryTable {
  return {
    id: "e1",
    holiday_type_name: "Package Holiday",
    travel_date: "2026-09-12",
    adults: 2,
    children: 0,
    infants: 0,
    no_of_nights: 7,
    budget: "3000",
    budget_type: "PER_PERSON",
    destinations: [{ destination_name: "Spain" }],
    airports: [{ airport_name: "Gatwick" }],
    boardBases: [{ board_basis_name: "All Inclusive" }],
    status: "NEW",
    ...over,
  } as unknown as EnquiryTable;
}

describe("buildEnquiryFields", () => {
  it("shows the standard-holiday rows", () => {
    const rows = flat(buildEnquiryFields(enquiry(), "Sam Agent"));
    expect(byKey(rows, "destination")?.value).toBe("Spain");
    expect(byKey(rows, "departure-airport")?.value).toBe("Gatwick");
    expect(byKey(rows, "no-passengers")?.value).toBe("2 Adults");
    expect(byKey(rows, "no-nights")?.value).toBe("7 nights");
    expect(byKey(rows, "budget")?.value).toBe("£3,000pp");
    expect(byKey(rows, "assigned-agent")).toMatchObject({ icon: "user-round", value: "Sam Agent" });
  });

  it("hides standard-only rows for a cruise and shows cruise ones", () => {
    const rows = flat(
      buildEnquiryFields(
        enquiry({ holiday_type_name: "Cruise Package", cruiseLines: [{ cruise_line_name: "P&O" }], ports: [{ port_name: "Southampton" }] }),
        null,
      ),
    );
    expect(byKey(rows, "departure-airport")?.value).toBeNull();
    expect(byKey(rows, "departure-port")?.value).toBe("Southampton");
    expect(byKey(rows, "cruise-line")?.value).toBe("P&O");
    expect(byKey(rows, "travel-date")?.label).toBe("Cruise Date");
  });

  it("prefers flexible nights over the fixed count", () => {
    const rows = flat(buildEnquiryFields(enquiry({ flexible_nights: [7, 10] }), null));
    expect(byKey(rows, "no-nights")?.value).toBe("7, 10 nights");
  });

  it("only uses icon keys that have a lucide mapping", () => {
    for (const row of flat(buildEnquiryFields(enquiry(), null))) expect(FIELD_ICONS[row.icon]).toBeDefined();
  });
});

describe("showTransferPill", () => {
  it("hides the hero pill for None and blank, shows real transfers", () => {
    expect(showTransferPill("None")).toBe(false);
    expect(showTransferPill(" none ")).toBe(false);
    expect(showTransferPill("")).toBe(false);
    expect(showTransferPill(null)).toBe(false);
    expect(showTransferPill("Private Transfer")).toBe(true);
  });
});
