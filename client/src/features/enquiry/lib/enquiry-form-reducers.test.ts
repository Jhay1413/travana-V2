import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, type EnquiryForm, type FieldKey, type Sources } from "./enquiry-form";
import {
  accommodationsPatch,
  chipForField,
  countriesPatch,
  destinationLabel,
  destinationsPatch,
  holidayTypePatch,
  resortsPatch,
} from "./enquiry-form-reducers";

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

  it("clears the destination when switching into or out of Cruise, not between other types", () => {
    const pkg = { ...DEFAULT_FORM, holidayTypeName: "Package Holiday", destinations: ["d1"], resorts: ["r1"], countries: ["c1"] };
    expect(holidayTypePatch(pkg, "pt3", "Cruise Package")).toMatchObject({ destinations: [], resorts: [], countries: [] });
    const cruise = { ...DEFAULT_FORM, holidayTypeName: "Cruise Package", destinations: ["d9"] };
    expect(holidayTypePatch(cruise, "pt1", "Package Holiday")).toMatchObject({ destinations: [] });
    expect(holidayTypePatch(pkg, "pt2", "Hot Tub Break")).not.toHaveProperty("destinations");
    expect(holidayTypePatch(DEFAULT_FORM, "pt3", "Cruise Package")).not.toHaveProperty("destinations");
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

describe("destinationLabel", () => {
  it("adds the country when known", () => {
    expect(destinationLabel(destinations[0], countries)).toBe("Lanzarote, Spain");
    expect(destinationLabel({ name: "Nowhere", country_id: null }, countries)).toBe("Nowhere");
  });
});

describe("countriesPatch", () => {
  const form: EnquiryForm = {
    ...DEFAULT_FORM,
    countries: ["c1", "c2"],
    destinations: ["d1", "d9"],
    resorts: ["r1"],
    countryOf: { d1: "c1", d9: "c2", r1: "c1" },
  };

  it("just sets the countries when none was removed", () => {
    expect(countriesPatch(form, ["c1", "c2", "c3"])).toEqual({ countries: ["c1", "c2", "c3"] });
  });

  it("prunes destinations and resorts that belonged only to a removed country", () => {
    expect(countriesPatch(form, ["c2"])).toEqual({ countries: ["c2"], destinations: ["d9"], resorts: [] });
  });

  it("keeps entries with an unknown country", () => {
    const loose: EnquiryForm = { ...form, destinations: ["dx"], countryOf: {} };
    expect(countriesPatch(loose, ["c2"]).destinations).toEqual(["dx"]);
  });
});

describe("accommodationsPatch", () => {
  const known = [
    {
      id: "a1",
      name: "Hotel Sol",
      resorts_id: "r1",
      resort_name: "Costa Teguise",
      destination_id: "d1",
      destination_name: "Lanzarote",
      country_id: "c1",
    },
  ];

  it("pulls in the resort, destination and country of a new accommodation", () => {
    const p = accommodationsPatch(DEFAULT_FORM, ["a1"], known, countries);
    expect(p).toMatchObject({
      accommodations: ["a1"],
      resorts: ["r1"],
      destinations: ["d1"],
      countries: ["c1"],
      destinationOf: { a1: "d1" },
    });
    expect(p.labels).toMatchObject({ a1: "Hotel Sol", r1: "Costa Teguise", d1: "Lanzarote, Spain" });
  });

  it("keeps countries already chosen", () => {
    const form: EnquiryForm = { ...DEFAULT_FORM, countries: ["c9"] };
    expect(accommodationsPatch(form, ["a1"], known, countries).countries).toEqual(["c9", "c1"]);
  });
});
