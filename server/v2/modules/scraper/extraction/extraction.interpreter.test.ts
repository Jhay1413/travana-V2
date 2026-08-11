import { describe, expect, it } from "vitest";
import { applyScalarOverrides, runExtractionSpec } from "./extraction.interpreter";
import type { ScrapedQuoteJson } from "../../easyjet/easyjet.types";
import type { ExtractionSpec } from "./extraction.types";

// Regression: the AI-generated spec for a supplier can be overfitted to the one
// example deal it was generated from (board_basis regex literally "Half Board",
// hardcoded URL slugs). The interpreter's supplier-agnostic fallbacks must fill
// board basis / occupancy / nights when such a spec extracts nothing.

const JET2_URL =
  "https://trade.jet2holidays.com/beach/canary-islands/gran-canaria/puerto-rico/cala-nova?airport=5&date=27-08-2026&duration=7&occupancy=r2c9r2c10r2c8r2c9";

// Mirrors the overfitted rules found in the stored "jet" spec.
const OVERFITTED_SPEC: ExtractionSpec = {
  version: 1,
  constants: { tour_operator: "Jet2holidays", currency: "GBP" },
  fields: {
    accommodation: { from: "title", regex: "^([^|]+)", group: 1 },
    board_basis: { from: "text", regex: "Half Board", group: 0, map: { "Half Board": "Half Board" } },
    adults: { from: "text", regex: "(\\d+) Adults? for \\d+ nights", group: 1, transform: "number" },
    no_of_nights: { from: "text", regex: "\\d+ Adults? for (\\d+) nights", group: 1, transform: "number" },
    sales_price: { from: "text", regex: "£([\\d,]+)", group: 1, transform: "number" },
  },
} as ExtractionSpec;

const PAGE_TEXT = [
  "Cala Nova",
  "Puerto Rico, Gran Canaria",
  "Self Catering",
  "One Bedroom apartment",
  "£6,190 total price",
  "Coach transfers included",
].join("\n");

const CTX = { title: "Cala Nova | Jet2holidays", text: PAGE_TEXT, url: JET2_URL };

describe("runExtractionSpec — supplier-agnostic fallbacks", () => {
  it("recovers board basis from the canonical vocabulary when the spec rule misses", () => {
    const out = runExtractionSpec(OVERFITTED_SPEC, CTX, "2026-08-05T00:00:00Z");
    expect(out.board_basis).toBe("Self Catering");
  });

  it("recovers occupancy and nights from the deal URL", () => {
    const out = runExtractionSpec(OVERFITTED_SPEC, CTX, "2026-08-05T00:00:00Z");
    // occupancy=r2c9r2c10r2c8r2c9 → 4 rooms × 2 adults, 4 child-age tokens.
    expect(out.adults).toBe(8);
    expect(out.children).toBe(4);
    expect(out.no_of_nights).toBe(7); // duration=7
    expect(out.travel_date).toBe("2026-08-27"); // date=27-08-2026 (URL fallback)
  });

  it("prefers the spec's own extraction when it matches", () => {
    const text = `${PAGE_TEXT}\n2 Adults for 10 nights\nHalf Board`;
    const out = runExtractionSpec(OVERFITTED_SPEC, { ...CTX, text }, "2026-08-05T00:00:00Z");
    expect(out.adults).toBe(2);
    expect(out.no_of_nights).toBe(10);
    expect(out.board_basis).toBe("Half Board"); // the spec's own match wins over the text scan
  });

  it("normalises vocabulary variants to canonical names", () => {
    const out = runExtractionSpec(
      OVERFITTED_SPEC,
      { ...CTX, text: "Bed & Breakfast\n£500" },
      "2026-08-05T00:00:00Z",
    );
    expect(out.board_basis).toBe("Bed and Breakfast");
  });
});

// The config-override path for code-based adapters (easyjet): a spec stored in
// supplier_scraper.config.extraction re-points scalar fields at the captured
// API JSON, on top of the code mapper's output.
describe("applyScalarOverrides", () => {
  const base = {
    sales_price: 4583,
    tourist_tax_total: 10,
    board_basis: "Bed and Breakfast",
    accommodation: "AMOH",
    flights: [{ flight_type: "outbound" }],
    hotel_images: ["a.jpg"],
  } as unknown as ScrapedQuoteJson;
  const apiJson = {
    offers: [{ price: 4583, priceExcludingTouristTax: 4573, boardTitle: "Half Board" }],
  };

  it("re-points a scalar at the API JSON, keeping the field numeric", () => {
    const out = applyScalarOverrides(
      base,
      { fields: { sales_price: { jsonPath: "offers[0].priceExcludingTouristTax" } } },
      { url: "https://example.com", apiJson },
    );
    expect(out.sales_price).toBe(4573);
  });

  it("keeps the mapped value when a rule resolves to nothing", () => {
    const out = applyScalarOverrides(
      base,
      { fields: { sales_price: { jsonPath: "offers[0].noSuchField" } } },
      { url: "https://example.com", apiJson },
    );
    expect(out.sales_price).toBe(4583);
  });

  it("cannot replace structured arrays or invent new fields", () => {
    const out = applyScalarOverrides(
      base,
      {
        fields: {
          flights: { jsonPath: "offers[0].price" },
          hotel_images: { jsonPath: "offers[0].price" },
          brand_new_field: { jsonPath: "offers[0].price" },
        },
      },
      { url: "https://example.com", apiJson },
    );
    expect(out.flights).toEqual([{ flight_type: "outbound" }]);
    expect(out.hotel_images).toEqual(["a.jpg"]);
    expect("brand_new_field" in out).toBe(false);
  });

  it("returns the base untouched without a spec", () => {
    expect(applyScalarOverrides(base, undefined, { url: "https://example.com" })).toEqual(base);
  });
});

// Flight-time extraction across the two layouts real trade portals use. Both
// snippets are lifted verbatim from live captures.
describe("flight legs", () => {
  const spec = {
    version: 1,
    constants: { tour_operator: "T", currency: "GBP" },
    fields: {},
  } as unknown as ExtractionSpec;

  // Jet2: a "Depart:/Arrive:" details modal, captured into flightsText.
  const JET2_MODAL = [
    "Going Out",
    "",
    "Newcastle  Reus (Barcelona South) REU",
    "",
    "Flight duration: 2 hrs 45 mins",
    "Depart: Sun 06 Sep 2026 at 16:30",
    "Arrive: Sun 06 Sep 2026 at 20:15",
    "",
    "Coming Back",
    "",
    "Reus (Barcelona South) REU  Newcastle",
    "",
    "Flight duration: 2 hrs 45 mins",
    "Depart: Sat 12 Sep 2026 at 11:10",
    "Arrive: Sat 12 Sep 2026 at 12:55",
  ].join("\n");

  // easyJet: a stacked itinerary inline in the page text, no modal at all.
  const EASYJET_TEXT = [
    "Your flights",
    "Fri 14th Aug 2026",
    "EZY2051",
    "17:00",
    "23:25",
    "Manchester",
    "(MAN)",
    "Rhodes, Diagoras",
    "(RHO)",
    "Sat 22nd Aug 2026",
    "EZY2052",
    "00:25",
    "02:55",
    "Rhodes, Diagoras",
    "(RHO)",
    "Manchester",
    "(MAN)",
    "Selected",
  ].join("\n");

  it("reads real times from a Depart:/Arrive: modal", () => {
    const q = runExtractionSpec(
      spec,
      { title: "", text: "Return flights Newcastle", url: "https://x.test/d", flightsText: JET2_MODAL },
      "2026-01-01T00:00:00Z",
    );
    expect(q.flights[0].departure_date_time).toBe("2026-09-06T16:30");
    expect(q.flights[0].arrival_date_time).toBe("2026-09-06T20:15");
    expect(q.flights[1].departure_date_time).toBe("2026-09-12T11:10");
    expect(q.flights[1].arrival_date_time).toBe("2026-09-12T12:55");
    expect(q.flights[0].arrival_airport).toBe("REU");
  });

  it("reads a stacked itinerary printed in the page text, with no modal", () => {
    const q = runExtractionSpec(
      spec,
      { title: "", text: EASYJET_TEXT, url: "https://x.test/d", flightsText: "" },
      "2026-01-01T00:00:00Z",
    );
    const [out, ret] = q.flights;
    expect(out.departure_date_time).toBe("2026-08-14T17:00");
    expect(out.arrival_date_time).toBe("2026-08-14T23:25");
    expect(out.departing_airport).toBe("MAN");
    expect(out.departing_airport_name).toBe("Manchester");
    expect(out.arrival_airport).toBe("RHO");
    expect(out.arrival_airport_name).toBe("Rhodes, Diagoras");
    expect(out.flight_number).toBe("EZY2051");

    expect(ret.departure_date_time).toBe("2026-08-22T00:25");
    expect(ret.arrival_date_time).toBe("2026-08-22T02:55");
    expect(ret.departing_airport).toBe("RHO");
    expect(ret.arrival_airport).toBe("MAN");
    expect(ret.flight_number).toBe("EZY2052");
  });

  it("leaves flights empty when the page states no airports at all", () => {
    const q = runExtractionSpec(spec, { title: "", text: "No flights here", url: "https://x.test/d" }, "2026-01-01T00:00:00Z");
    expect(q.flights).toEqual([]);
  });

  // Jet2 again, but captured while the panel was CLOSED. Nothing is rendered, so
  // innerText degrades to textContent and the deep-text walker emits one line per
  // text node — the <h3> holding "Newcastle <svg/> Reus (Barcelona South) REU"
  // arrives as TWO lines. Agents capture without opening the panel most of the
  // time, so this is the common shape, not the exotic one.
  const JET2_MODAL_CLOSED = [
    "Flight Information",
    "Going Out",
    "Newcastle",
    "Reus (Barcelona South) REU",
    "Depart: Sun 06 Sep 2026 at 16:30",
    "Arrive: Sun 06 Sep 2026 at 20:15",
    "Flight duration: 2 hrs 45 mins",
    "Coming Back",
    "Reus (Barcelona South) REU",
    "Newcastle",
    "Depart: Sat 12 Sep 2026 at 11:10",
    "Arrive: Sat 12 Sep 2026 at 12:55",
    "Flight duration: 2 hrs 45 mins",
  ].join("\n");

  it("reads the same flights when the airport pair is split across two lines", () => {
    const q = runExtractionSpec(
      spec,
      { title: "", text: "Return flights Newcastle", url: "https://x.test/d", flightsText: JET2_MODAL_CLOSED },
      "2026-01-01T00:00:00Z",
    );
    const [out, ret] = q.flights;
    expect(out.departing_airport_name).toBe("Newcastle");
    expect(out.arrival_airport).toBe("REU");
    // The point of the fix: the destination NAME, not the bare code.
    expect(out.arrival_airport_name).toBe("Reus (Barcelona South)");
    expect(out.departure_date_time).toBe("2026-09-06T16:30");
    expect(out.arrival_date_time).toBe("2026-09-06T20:15");
    expect(ret.departure_date_time).toBe("2026-09-12T11:10");
    expect(ret.arrival_date_time).toBe("2026-09-12T12:55");
  });

  // The two-line join must not fire on a portal whose second line is something
  // else entirely — it is only allowed to recover an airport code the first line
  // genuinely lacked.
  it("ignores a second line that carries no airport code", () => {
    const withNoise = [
      "Going Out",
      "Newcastle  Reus (Barcelona South) REU",
      "Operated by a partner airline",
      "Depart: Sun 06 Sep 2026 at 16:30",
      "Arrive: Sun 06 Sep 2026 at 20:15",
      "Coming Back",
      "Depart: Sat 12 Sep 2026 at 11:10",
      "Arrive: Sat 12 Sep 2026 at 12:55",
    ].join("\n");
    const q = runExtractionSpec(
      spec,
      { title: "", text: "Return flights Newcastle", url: "https://x.test/d", flightsText: withNoise },
      "2026-01-01T00:00:00Z",
    );
    expect(q.flights[0].arrival_airport_name).toBe("Reus (Barcelona South)");
    expect(q.flights[0].departing_airport_name).toBe("Newcastle");
  });
});

// Galleries served through the site's own image optimiser: every photo shares
// one host, and srcs arrive in both absolute and root-relative form.
describe("gallery selection behind an image proxy", () => {
  const spec = { version: 1, fields: {} } as unknown as ExtractionSpec;
  const PAGE = "https://www.easyjet.com/en/holidays/trade-portal/greece/rhodes/pefkos/a-hotel";
  const P = "https://www.easyjet.com/holidays/_next/image?url=";
  const S3 = "https%3A%2F%2Fejh-web-prod-images.s3-eu-west-1.amazonaws.com%2F";
  const CMS = "%2Fholidays%2Fcms%2Fmedia%2F-%2Fjssmedia%2F";

  const images = [
    { src: "https://www.easyjet.com/holidays/cms/media/-/jssmedia/project/holidays/default/logo/a-logo.svg" },
    { src: `${P}${S3}GRRH0107_am%2FSmall%2FGRRH0107_100.jpg&w=3840&q=75` },
    { src: `${P}${S3}GRRH0107_am%2FSmall%2FGRRH0107_127.jpg&w=3840&q=75` },
    // root-relative — must not be discarded
    { src: `/holidays/_next/image?url=${S3}GRRH0107_am%2FSmall%2FGRRH0107_148.jpg&w=3840&q=75` },
    { src: `/holidays/_next/image?url=${S3}GRRH0107_am%2FSmall%2FGRRH0107_122.jpg&w=3840&q=75` },
    // marketing tiles: same proxy host, but the wrapped URL is a CMS path
    { src: `${P}${CMS}project%2Fholidays%2Fluxury%2Ftiles%2Fyour-inside-line.jpeg&w=3840&q=75` },
    { src: `${P}${CMS}project%2Fholidays%2Fluxury%2Ftiles%2Ftake-a-weight-off.jpeg&w=3840&q=75` },
    { src: "https://www.tripadvisor.com/img/cdsi/img2/ratings/traveler/4.0.svg" },
  ];

  it("keeps the photo-CDN images and drops proxied brand/marketing tiles", () => {
    const q = runExtractionSpec(spec, { title: "", text: "x".repeat(300), url: PAGE, images }, "x");
    expect(q.hotel_images).toHaveLength(4);
    expect(q.hotel_images.every((s) => s.includes("ejh-web-prod-images"))).toBe(true);
    expect(q.hotel_images.some((s) => /tiles|logo|tripadvisor/i.test(s))).toBe(false);
  });

  it("resolves root-relative srcs instead of discarding them", () => {
    const q = runExtractionSpec(spec, { title: "", text: "x".repeat(300), url: PAGE, images }, "x");
    expect(q.hotel_images.filter((s) => s.startsWith("https://")).length).toBe(4);
    expect(q.hotel_images.some((s) => s.includes("GRRH0107_148"))).toBe(true);
  });

  // Regression: easyJet's booking JSON publishes every photo three times over —
  // {large, medium, small} — and writes the size as a PATH segment (…/Small/…),
  // not a query parameter. Deduping on the query string alone let all three
  // through, so the quote form's image picker showed each picture 2-3 times.
  // Only easyJet tripped this: the other portals size via "?w=" or a ":preset".
  describe("one photo published at several sizes", () => {
    const s3 = (size: string, n: string) =>
      `https://ejh-web-prod-images.s3-eu-west-1.amazonaws.com/GRRH0107_am/${size}/GRRH0107_${n}.jpg`;
    const apiJson = {
      hotel: {
        images: [
          { large: s3("Large", "100"), medium: s3("Medium", "100"), small: s3("Small", "100") },
          { large: s3("Large", "127"), medium: s3("Medium", "127"), small: s3("Small", "127") },
        ],
      },
      // The room gallery repeats hotel photography, at whatever size it holds.
      offers: [{ accom: { unit: [{ roomType: { images: [{ medium: s3("Medium", "100") }] } }] } }],
    };
    const gallery = () =>
      runExtractionSpec(spec, { title: "", text: "x".repeat(300), url: PAGE, apiJson }, "x").hotel_images;

    it("counts each photo once", () => {
      expect(gallery()).toHaveLength(2);
    });

    it("keeps the largest variant of each", () => {
      expect(gallery().every((s) => s.includes("/Large/"))).toBe(true);
    });

    it("still tells genuinely different photos apart", () => {
      const names = gallery().map((s) => s.slice(s.lastIndexOf("/") + 1));
      expect(new Set(names).size).toBe(2);
    });
  });
});

// titleCase is applied to both URL slugs and SHOUTED page text.
describe("titleCase transform", () => {
  const run = (text: string, url: string, rule: Record<string, unknown>) =>
    runExtractionSpec(
      { version: 1, fields: { destination: rule } } as unknown as ExtractionSpec,
      { title: "", text, url },
      "x",
    ).destination;

  it("normalises ALL-CAPS page text", () => {
    expect(run("IN PRAGUE, CZECH REPUBLIC", "https://x.test/d", { from: "text", group: 1, regex: "IN ([A-Z ]+),", transform: "titleCase" })).toBe("Prague");
    expect(run("IN PRAGUE, CZECH REPUBLIC", "https://x.test/d", { from: "text", group: 2, regex: "IN ([A-Z ]+), ([A-Z ]+)", transform: "titleCase" })).toBe("Czech Republic");
  });

  it("still title-cases URL slugs, and leaves mixed case alone", () => {
    expect(run("", "https://x.test/a/costa-dorada", { from: "url", urlSegment: 1, transform: "titleCase" })).toBe("Costa Dorada");
    expect(run("easyJet holidays", "https://x.test/d", { from: "text", group: 1, regex: "(easyJet)", transform: "titleCase" })).toBe("EasyJet");
  });
});

// Portals whose own UI assets outnumber the real photography: counting images
// per host picks the chrome, so the gallery is identified by being served from
// a DIFFERENT origin than the page.
describe("gallery selection against site chrome", () => {
  const spec = { version: 1, fields: {} } as unknown as ExtractionSpec;
  const gallery = (url: string, srcs: string[]) =>
    runExtractionSpec(spec, { title: "", text: "x".repeat(300), url, images: srcs.map((s) => ({ src: s })) }, "x")
      .hotel_images;

  it("ignores static UI assets that outnumber the photos", () => {
    const page = "https://retailagents.tui.co.uk/retail/bookaccommodation?productCode=1";
    const chrome = [
      "https://www.tui.co.uk/static-images/_ui/mobile/framework/TUI-Logo.svg",
      "https://www.tui.co.uk/static-images/_ui/desktop/th/images/uk_flag.png",
      "https://www.tui.co.uk/static-images/_ui/mobile/framework/Citybreaks.svg",
      "https://www.tui.co.uk/static-images/_ui/mobile/framework/image_coming_soon.png",
      "https://www.tui.co.uk/static-images/_ui/mobile/framework/reason_to_book_atol_icon.png",
      "https://www.tui.co.uk/static-images/_ui/mobile/framework/reason_to_book_kids_icon.png",
      "https://mwa.tui.com/shared/mwa/assets/v2/pictograms/room-change.svg",
    ];
    const photos = [
      "https://cdn.images.tui/tui-images/c0455ef0.jpg?crop=edges&w=1080",
      "https://content.tui.co.uk/adamtui/2016_9/CZE_PRA_F164WebOriginalCompressed.jpg?i10c=img.resize(width:488)",
    ];
    const g = gallery(page, [...chrome, ...photos]);
    expect(g).toHaveLength(2);
    expect(g.some((s) => /static-images|_ui|pictogram/.test(s))).toBe(false);
  });

  it("keeps a photo CDN and drops the portal's own promo/agency images", () => {
    const page = "https://trade.jet2holidays.com/beach/spain/salou/a-hotel";
    const g = gallery(page, [
      "https://trade.jet2holidays.com/-/media/images/jet2holidays%20logo.png",
      "https://trade.jet2holidays.com/HotelImages/Tradelogo/AGENCY.jpg",
      "https://www.jet2holidays.com/-/media/assets/free_express_transfers-min.jpeg?w=700",
      "https://maps.googleapis.com/maps/api/staticmap?center=41.08,1.14",
      "https://media.jet2.com/is/image/jet2/REU_69585_Sol_Costa_Daurada_0625_05",
      "https://media.jet2.com/is/image/jet2/REU_69585_Sol_Costa_Daurada_0625_07",
    ]);
    expect(g).toHaveLength(2);
    expect(g.every((s) => s.includes("media.jet2.com"))).toBe(true);
  });
});

// Third layout: OUT/RTN leg cards with bare IATA codes (TUI).
describe("flight leg cards", () => {
  const spec = { version: 1, fields: {} } as unknown as ExtractionSpec;

  const TUI_TEXT = [
    "Durations",
    "2 nights", "-£206pp", "6 nights",
    "Your flights",
    "46 flights available",
    "See alternative flights",
    "OUT",
    "Sun 30 Aug 2026",
    "06:00",
    "Direct",
    "1h 50m",
    "08:50",
    "London Stansted",
    "STN",
    "Prague",
    "PRG",
    "Ryanair",
    "RTN",
    "Sat 05 Sep 2026",
    "06:10",
    "Direct",
    "1h 55m",
    "07:05",
    "Prague",
    "PRG",
    "London Stansted",
    "STN",
    "Ryanair",
    "Selected",
    "Your room",
  ].join("\n");

  it("reads both legs from OUT/RTN cards", () => {
    const q = runExtractionSpec(spec, { title: "", text: TUI_TEXT, url: "https://x.test/d" }, "x");
    const [out, ret] = q.flights;
    expect(out.departure_date_time).toBe("2026-08-30T06:00");
    expect(out.arrival_date_time).toBe("2026-08-30T08:50");
    expect(out.departing_airport).toBe("STN");
    expect(out.arrival_airport).toBe("PRG");
    expect(ret.departure_date_time).toBe("2026-09-05T06:10");
    expect(ret.arrival_date_time).toBe("2026-09-05T07:05");
    expect(ret.departing_airport).toBe("PRG");
    expect(ret.arrival_airport).toBe("STN");
  });

  it("does not hijack a page whose flights use the Depart:/Arrive: modal", () => {
    const modal = [
      "Going Out", "Newcastle  Reus (Barcelona South) REU",
      "Depart: Sun 06 Sep 2026 at 16:30", "Arrive: Sun 06 Sep 2026 at 20:15",
      "Coming Back", "Reus (Barcelona South) REU  Newcastle",
      "Depart: Sat 12 Sep 2026 at 11:10", "Arrive: Sat 12 Sep 2026 at 12:55",
    ].join("\n");
    const q = runExtractionSpec(spec, { title: "", text: "x", url: "https://x.test/d", flightsText: modal }, "x");
    expect(q.flights[0].departure_date_time).toBe("2026-09-06T16:30");
    expect(q.flights[0].arrival_airport).toBe("REU");
  });
});

// Best source: the operator's embedded booking JSON. Both fixtures are lifted
// verbatim from a live TUI capture — the SAME page carries two different shapes,
// so one code path has to read both.
describe("flights from booking JSON", () => {
  const spec = { version: 1, fields: {} } as unknown as ExtractionSpec;
  const run = (apiJson: unknown) =>
    runExtractionSpec(spec, { title: "", text: "x".repeat(300), url: "https://x.test/d", apiJson }, "x").flights;

  // packageData.itinerary.* — airports as strings + separate *Code fields,
  // times as "0600", flight number on carrier.
  const ITINERARY = {
    packageData: {
      itinerary: {
        outbounds: [
          {
            departureAirport: "London Stansted", departureAirportCode: "STN",
            arrivalAirport: "Prague", arrivalAirportCode: "PRG",
            schedule: {
              departureDate: "30-08-2026", departureTime: "0600",
              arrivalDate: "30-08-2026", arrivalTime: "0850",
              formattedDepartureTime: "06:00", formattedArrivalTime: "08:50",
            },
            carrier: { name: "Ryanair", carrierCode: "FR", flightNumber: "FR1013" },
          },
        ],
        inbounds: [
          {
            departureAirport: "Prague", departureAirportCode: "PRG",
            arrivalAirport: "London Stansted", arrivalAirportCode: "STN",
            schedule: {
              departureDate: "05-09-2026", departureTime: "0610",
              arrivalDate: "05-09-2026", arrivalTime: "0705",
              formattedDepartureTime: "06:10", formattedArrivalTime: "07:05",
            },
            carrier: { name: "Ryanair", carrierCode: "FR", flightNumber: "FR1427" },
          },
        ],
      },
    },
  };

  // packageViewData.flightViewData[].{outbound,inbound}Sectors — airports as
  // {code,name} objects, times as depTime/arrTime, dates written out longhand.
  const SECTORS = {
    packageViewData: {
      flightViewData: [
        {
          outboundSectors: [
            {
              departureAirport: { code: "STN", name: "London Stansted", terminal: "" },
              arrivalAirport: { code: "PRG", name: "Prague", terminal: "" },
              schedule: { depTime: "06:00", arrTime: "08:50", departureDate: "Sun 30 Aug 2026", arrivalDate: "Sun 30 Aug 2026" },
              flightNumber: "1013", carrierName: "Ryanair",
            },
          ],
          inboundSectors: [
            {
              departureAirport: { code: "PRG", name: "Prague", terminal: "" },
              arrivalAirport: { code: "STN", name: "London Stansted", terminal: "" },
              schedule: { depTime: "06:10", arrTime: "07:05", departureDate: "Sat 5 Sep 2026", arrivalDate: "Sat 5 Sep 2026" },
              flightNumber: "1427", carrierName: "Ryanair",
            },
          ],
        },
      ],
    },
  };

  for (const [label, fixture] of [["itinerary shape", ITINERARY], ["sectors shape", SECTORS]] as const) {
    it(`reads both legs from the ${label}`, () => {
      const [out, ret] = run(fixture);
      expect(out.departure_date_time).toBe("2026-08-30T06:00");
      expect(out.arrival_date_time).toBe("2026-08-30T08:50");
      expect(out.departing_airport).toBe("STN");
      expect(out.departing_airport_name).toBe("London Stansted");
      expect(out.arrival_airport).toBe("PRG");
      expect(out.arrival_airport_name).toBe("Prague");

      expect(ret.departure_date_time).toBe("2026-09-05T06:10");
      expect(ret.arrival_date_time).toBe("2026-09-05T07:05");
      expect(ret.departing_airport).toBe("PRG");
      expect(ret.arrival_airport).toBe("STN");
    });
  }

  it("prefers the JSON over a conflicting text itinerary", () => {
    const misleading = ["OUT", "Mon 01 Jan 2020", "09:99", "10:00", "Nowhere", "NON", "Elsewhere", "ELS"].join("\n");
    const flights = runExtractionSpec(
      spec,
      { title: "", text: misleading, url: "https://x.test/d", apiJson: ITINERARY, flightsText: misleading },
      "x",
    ).flights;
    expect(flights[0].departure_date_time).toBe("2026-08-30T06:00");
    expect(flights[0].arrival_airport).toBe("PRG");
  });

  it("falls back to text when the page embeds no booking JSON", () => {
    const cards = ["OUT", "Sun 30 Aug 2026", "06:00", "08:50", "London Stansted", "STN", "Prague", "PRG"].join("\n");
    const flights = runExtractionSpec(spec, { title: "", text: cards, url: "https://x.test/d", apiJson: null }, "x").flights;
    expect(flights[0].departure_date_time).toBe("2026-08-30T06:00");
  });
});

// Rendered galleries are lazy-loaded, so the <img> list is a partial view; the
// booking JSON lists the whole set.
describe("gallery from booking JSON", () => {
  const spec = { version: 1, fields: {} } as unknown as ExtractionSpec;
  const PAGE = "https://retailagents.tui.co.uk/retail/bookaccommodation?productCode=1";
  const CDN = "https://cdn.images.tui/tui-images/";
  const CHROME = "https://www.tui.co.uk/static-images/_ui/mobile/framework/";

  // Two slides loaded, the rest still "image coming soon" placeholders.
  const lazyDom = [
    CHROME + "TUI-Logo.svg",
    CDN + "aaa.jpg?crop=edges&w=1080&h=608",
    CDN + "bbb.jpg?crop=edges&w=1080&h=608",
    ...Array.from({ length: 20 }, () => CHROME + "image_coming_soon.png"),
  ].map((src) => ({ src }));

  const apiJson = {
    packageData: {
      accommodation: {
        imageUrl: CDN + "aaa.jpg?crop=edges&w=658&h=370",
        imageUrls: [CDN + "bbb.jpg?w=232&h=130", CDN + "ccc.jpg?w=232&h=130"],
      },
    },
    flightViewData: [{ carrierLogo: "https://mwa.tui.com/shared/assets/logos/airline/FR-ryanair.svg" }],
  };

  const gallery = (images: { src: string }[], json?: unknown) =>
    runExtractionSpec(spec, { title: "", text: "x".repeat(300), url: PAGE, images, apiJson: json }, "x").hotel_images;

  it("recovers photos that lazy-loading never rendered", () => {
    expect(gallery(lazyDom)).toHaveLength(2); // only what the DOM had
    const merged = gallery(lazyDom, apiJson);
    expect(merged).toHaveLength(3); // ccc.jpg came from the JSON alone
    expect(merged.some((s) => s.includes("ccc.jpg"))).toBe(true);
  });

  it("never emits placeholders, chrome or airline logos", () => {
    const merged = gallery(lazyDom, apiJson);
    expect(merged.some((s) => /coming_soon|static-images|logo|\.svg/i.test(s))).toBe(false);
  });

  it("keeps the widest variant when one photo appears at several sizes", () => {
    const merged = gallery(lazyDom, apiJson);
    const aaa = merged.find((s) => s.includes("aaa.jpg"));
    expect(aaa).toContain("w=1080"); // not the 658 from JSON, nor a thumbnail
  });
});

// A jsonPath can land on a COMPOSITE value (an occupancy string, a label). The
// number transform must reject those rather than mangle them into a plausible
// figure, so the rule falls through to its regex/DOM source.
describe("number transform", () => {
  const spec = (rule: Record<string, unknown>) =>
    ({ version: 1, fields: { adults: rule } } as unknown as ExtractionSpec);
  const run = (rule: Record<string, unknown>, apiJson: unknown, text: string) =>
    runExtractionSpec(spec(rule), { title: "", text: text.padEnd(300, " "), url: "https://x.test/d", apiJson }, "x").adults;

  it("rejects a composite value instead of concatenating its digits", () => {
    // "A:02 C:00 I:00" once became 20000 — every occupancy field on the quote.
    // 3 (not the interpreter default of 2) so this can only pass by falling
    // through to the DOM regex.
    const got = run(
      { from: "text", group: 1, regex: "(\\d+) Adults?", jsonPath: "occ", transform: "number" },
      { occ: "A:02 C:00 I:00" },
      "3 Adults for 6 nights",
    );
    expect(got).toBe(3);
  });

  it("still accepts genuinely numeric values, with symbols or units around them", () => {
    const cases: [string, number][] = [
      ["1646.00", 1646], ["£1,646", 1646], ["4", 4], ["2 Adults", 2], ["6 nights", 6], ["£20.54 pppn", 20.54],
    ];
    for (const [raw, expected] of cases) {
      expect(run({ from: "text", jsonPath: "v", transform: "number" }, { v: raw }, "")).toBe(expected);
    }
  });

  it("leaves a field empty rather than inventing a number from prose", () => {
    // discount has no interpreter default, unlike adults/nights.
    const q = runExtractionSpec(
      { version: 1, fields: { discount: { from: "text", jsonPath: "v", transform: "number" } } } as unknown as ExtractionSpec,
      { title: "", text: "x".repeat(300), url: "https://x.test/d", apiJson: { v: "Half Board" } },
      "x",
    );
    expect(q.discount).toBe(0);
  });
});

// Analytics blobs write dates with no separators.
describe("compact date parsing", () => {
  const run = (raw: string) =>
    runExtractionSpec(
      { version: 1, fields: { travel_date: { from: "text", jsonPath: "d", transform: "date" } } } as unknown as ExtractionSpec,
      { title: "", text: "x".repeat(300), url: "https://x.test/d", apiJson: { d: raw } },
      "x",
    ).travel_date;

  it("reads DDMMYYYY", () => {
    expect(run("06092026")).toBe("2026-09-06"); // Jet2 dataLayer dimension4
    expect(run("12092026")).toBe("2026-09-12");
  });

  it("reads YYYYMMDD, told apart by a plausible leading year", () => {
    expect(run("20260906")).toBe("2026-09-06");
  });

  // "1909"/"2009" look like years, but 19 Sep / 20 Sep is what they are — the
  // YYYYMMDD reading would give month 20 and the DB rejects it.
  it("reads DDMMYYYY whose leading digits look like a year", () => {
    expect(run("19092026")).toBe("2026-09-19");
    expect(run("20092026")).toBe("2026-09-20");
    expect(run("19122026")).toBe("2026-12-19");
  });

  it("leaves 8 digits that are no date either way alone", () => {
    expect(run("99999999")).toBe("99999999");
  });

  it("still reads the separated forms", () => {
    expect(run("2026-09-06")).toBe("2026-09-06");
    expect(run("06-09-2026")).toBe("2026-09-06");
    expect(run("06 Sep 2026")).toBe("2026-09-06");
  });
});

// Some portals publish flight times only as loose analytics values, never as an
// itinerary any parser could recognise (Jet2's dataLayer). Named spec fields
// let a config point at them.
describe("flight times from spec fields", () => {
  const P = "0.ecommerce.detail.products[0]";
  const spec = {
    version: 1,
    fields: {
      travel_date: { from: "text", jsonPath: `${P}.dimension4`, transform: "date" },
      no_of_nights: { from: "text", jsonPath: `${P}.dimension7`, transform: "number" },
      departure_airport: { from: "text", jsonPath: `${P}.departureAirportCode` },
      arrival_airport: { from: "text", jsonPath: `${P}.destinationAirportCode` },
      outbound_depart_time: { from: "text", jsonPath: `${P}.dimension19` },
      inbound_depart_time: { from: "text", jsonPath: `${P}.dimension20` },
    },
  } as unknown as ExtractionSpec;

  const apiJson = [
    {
      ecommerce: {
        detail: {
          products: [
            {
              dimension4: "06092026", dimension7: 6, dimension19: "16:30", dimension20: "11:10",
              departureAirportCode: "NCL", destinationAirportCode: "REU",
            },
          ],
        },
      },
    },
  ];

  it("builds both legs from loose times plus the travel date", () => {
    const [out, ret] = runExtractionSpec(
      spec,
      { title: "", text: "x".repeat(300), url: "https://trade.jet2holidays.com/a/b", apiJson },
      "x",
    ).flights;
    expect(out.departure_date_time).toBe("2026-09-06T16:30");
    expect(out.departing_airport).toBe("NCL");
    expect(out.arrival_airport).toBe("REU");
    // The blob carries no arrival times, so those stay date-only rather than
    // being invented.
    expect(out.arrival_date_time).toBe("2026-09-06");
    expect(ret.departure_date_time).toBe("2026-09-12T11:10"); // travel date + nights
  });

  it("prefers a real itinerary over the loose times when both exist", () => {
    const modal = [
      "Going Out", "Newcastle  Reus (Barcelona South) REU",
      "Depart: Sun 06 Sep 2026 at 06:00", "Arrive: Sun 06 Sep 2026 at 09:15",
      "Coming Back", "Reus (Barcelona South) REU  Newcastle",
      "Depart: Sat 12 Sep 2026 at 20:00", "Arrive: Sat 12 Sep 2026 at 21:30",
    ].join("\n");
    const [out] = runExtractionSpec(
      spec,
      { title: "", text: "x".repeat(300), url: "https://trade.jet2holidays.com/a/b", apiJson, flightsText: modal },
      "x",
    ).flights;
    expect(out.departure_date_time).toBe("2026-09-06T06:00"); // modal wins over dimension19
    expect(out.arrival_date_time).toBe("2026-09-06T09:15");
  });
});

// Regression: a TUI Maldives deal imported with Country, Destination, Resort and
// Accommodation ALL blank. The form resolves the four as a chain, so a hole in
// the middle orphans everything under it — a resort cannot be created without a
// destination, nor a hotel without a resort. Portals legitimately publish fewer
// than four levels, so the interpreter carries the nearest level above downward.
describe("geo hierarchy", () => {
  const geoSpec = (): ExtractionSpec =>
    ({
      version: 1,
      fields: {
        country: { from: "text", regex: "IN (?:[A-Z ]+?,\s*)?([A-Z ]+)", group: 1, transform: "titleCase" },
        destination: { from: "text", regex: "IN ([A-Z ]+?),", group: 1, transform: "titleCase" },
        resort: { from: "text", regex: "IN ([A-Z ]+?),", group: 1, transform: "titleCase" },
      },
    }) as ExtractionSpec;

  const run = (text: string) =>
    runExtractionSpec(geoSpec(), { title: "TUI", text, url: "https://retailagents.tui.co.uk/retail/x", images: [] }, "x");

  it("reads city and country when the page prints both", () => {
    const q = run("\nPlaza Prague Hotel\n\nIN PRAGUE, CZECH REPUBLIC\n");
    expect(q.country).toBe("Czech Republic");
    expect(q.destination).toBe("Prague");
  });

  it("fills the gap when the destination IS the country", () => {
    // TUI prints a bare "IN MALDIVES" — no city, no comma.
    const q = run("\nBandos Maldives\n\nIN MALDIVES\n");
    expect(q.country).toBe("Maldives");
    expect(q.destination).toBe("Maldives"); // carried down from country
    expect(q.resort).toBe("Maldives"); // carried down from destination
  });

  it("carries destination into an absent resort", () => {
    // A city break has a destination but no resort.
    const q = run("\nPlaza Prague Hotel\n\nIN PRAGUE, CZECH REPUBLIC\n");
    expect(q.resort).toBe("Prague");
  });

  it("leaves every level empty when the page says nothing", () => {
    const q = run("\nSome Hotel\n\nno location line here\n");
    expect([q.country, q.destination, q.resort]).toEqual(["", "", ""]);
  });
});
