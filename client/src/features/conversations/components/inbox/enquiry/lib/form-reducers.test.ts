import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, type EnquiryForm, type FieldKey, type Sources } from "./enquiry-form";
import { chipForField, destinationsPatch, holidayTypePatch, resortsPatch } from "./form-reducers";

const countries = [{ id: "c1", country_name: "Spain", country_code: "ES" }];
const destinations = [
  { id: "d1", name: "Lanzarote", type: null, country_id: "c1" },
  { id: "d2", name: "Tenerife", type: null, country_id: "c1" },
];
const resorts = [
  { id: "r1", name: "Costa Teguise", destination_id: "d1", destination_name: "Lanzarote", country_id: "c1" },
];

describe("destinationsPatch", () => {
  it("sets the title from the first destination while it is auto", () => {
    expect(destinationsPatch(DEFAULT_FORM, ["d1"], destinations, countries, true)).toMatchObject({
      destinations: ["d1"],
      title: "Lanzarote holiday",
      countries: ["c1"],
    });
  });

  it("leaves an edited title alone", () => {
    expect(destinationsPatch(DEFAULT_FORM, ["d1"], destinations, countries, false)).not.toHaveProperty("title");
  });

  it("drops resorts whose destination was removed", () => {
    const form: EnquiryForm = { ...DEFAULT_FORM, destinations: ["d1"], resorts: ["r1"], destinationOf: { r1: "d1" } };
    expect(destinationsPatch(form, ["d2"], destinations, countries, true).resorts).toEqual([]);
  });
});

describe("resortsPatch", () => {
  it("adds the resort's destination and country, and follows the title", () => {
    const p = resortsPatch(DEFAULT_FORM, ["r1"], resorts as never, countries, true);
    expect(p).toMatchObject({
      resorts: ["r1"],
      destinations: ["d1"],
      countries: ["c1"],
      destinationOf: { r1: "d1" },
      title: "Lanzarote holiday",
    });
    expect(p.labels).toMatchObject({ r1: "Costa Teguise", d1: "Lanzarote, Spain" });
  });
});

describe("holidayTypePatch", () => {
  it("drops a flexibility the new type does not offer", () => {
    const form = { ...DEFAULT_FORM, flexibility: "Anytime in Month" };
    expect(holidayTypePatch(form, "pt3", "Cruise Package")).toMatchObject({ holidayType: "pt3", flexibility: "" });
    expect(holidayTypePatch(form, "pt1", "Package Holiday")).not.toHaveProperty("flexibility");
  });
});

describe("chipForField", () => {
  const sources = { destinations: "chat", title: "set" } as Sources;
  const filled: EnquiryForm = { ...DEFAULT_FORM, destinations: ["d1"] };
  const none = new Set<FieldKey>();

  it("shows the source until the agent edits, then 'checked'", () => {
    expect(chipForField(filled, sources, none, "destinations")).toBe("chat");
    expect(chipForField(filled, sources, new Set<FieldKey>(["destinations"]), "destinations")).toBe("checked");
  });

  it("shows nothing for an empty field unless flagged", () => {
    expect(chipForField(DEFAULT_FORM, sources, none, "destinations")).toBeNull();
    expect(chipForField(DEFAULT_FORM, { ...sources, destinations: "check" }, none, "destinations")).toBe("check");
  });
});
