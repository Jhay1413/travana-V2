import { describe, expect, it } from "vitest";
import {
  bookingAllocationOptions,
  enquiryAllocationOptions,
  noAllocationsMessage,
  quoteAllocationOptions,
} from "./upload-allocation";

describe("upload allocation options", () => {
  it("lists the client's real bookings, the stored value being the booking's own id", () => {
    const options = bookingAllocationOptions([
      { id: "9f1c0b52-1111-4a2b-8c3d-000000000001", title: "Hard Rock Hotel Tenerife", travel_date: "2027-04-09" },
      { id: "9f1c0b52-1111-4a2b-8c3d-000000000002", title: "  ", travel_date: null },
    ]);
    expect(options).toEqual([
      { id: "9f1c0b52-1111-4a2b-8c3d-000000000001", label: "Hard Rock Hotel Tenerife · 09/04/2027" },
      { id: "9f1c0b52-1111-4a2b-8c3d-000000000002", label: "Untitled booking" },
    ]);
  });

  it("lists enquiries with their own ids and never the old made-up ones", () => {
    const options = enquiryAllocationOptions([{ id: "e-1", title: "Family trip", travel_date: "2027-08-01" }, { id: "e-2" }]);
    expect(options.map((o) => o.id)).toEqual(["e-1", "e-2"]);
    expect(options.map((o) => o.label)).toEqual(["Family trip · 01/08/2027", "Untitled enquiry"]);
    expect(JSON.stringify(options)).not.toMatch(/enquiry-\d|booking-\d/);
  });

  it("keeps the quote wording the dialog always had", () => {
    expect(
      quoteAllocationOptions([
        { id: "q-1", title: "Tenerife", quote_status: "Sent" },
        { id: "q-2", title: null, quote_type: "Flight", quote_status: null },
        { id: "q-3" },
      ]),
    ).toEqual([
      { id: "q-1", label: "Tenerife - Sent" },
      { id: "q-2", label: "Flight - —" },
      { id: "q-3", label: "Quote - —" },
    ]);
  });

  it("gives nothing for a client with no deals, and says so in plain words", () => {
    expect(bookingAllocationOptions([])).toEqual([]);
    expect(noAllocationsMessage("Booking")).toBe("This client has no bookings yet.");
    expect(noAllocationsMessage("Enquiry")).toBe("This client has no enquiries yet.");
    expect(noAllocationsMessage("Quote")).toBe("This client has no quotes yet.");
  });
});
