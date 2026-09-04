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

// From a real TUI retail-agents capture. TUI does two things no other portal
// does: it packs the resize instruction into a COMPOUND query parameter
// ("?i10c=img.resize(width:470)" — colon, not "="), and it embeds a Qualtrics
// survey widget whose button images sit off-site alongside the photo CDN.
describe("gallery from a TUI capture", () => {
  const spec = { version: 1, fields: {} } as unknown as ExtractionSpec;
  const PAGE = "https://retailagents.tui.co.uk/retail/bookaccommodation?productCode=013537";
  const C = "https://content.tui.co.uk/adamtui/";
  const size = (w: number, h: number) => `?i10c=img.resize(width:${w});img.crop(width:${w}%2Cheight:${h})`;
  const TUN_12 = `${C}2018_4/19_9/fa7bc8f4/ACC_013537_TUN_12WebOriginalCompressed.jpg`;
  const TUN_13 = `${C}2018_4/19_9/9fea3bf6/ACC_013537_TUN_13WebOriginalCompressed.jpg`;

  const images = [
    { src: "https://www.tui.co.uk/static-images/_ui/mobile/framework/tui-light/TUI-Logo.svg" },
    { src: TUN_12 + size(470, 265) },
    { src: "https://www.tui.co.uk/static-images/_ui/mobile/framework/tui-light/image_coming_soon.png" },
    { src: "https://mwa.tui.com/shared/mwa/assets/v2/pictograms/room-change.svg" },
    // Qualtrics' survey prompt — off-site, and its filename reads as neither
    // chrome nor photography.
    { src: "https://siteintercept.qualtrics.com/WRQualtricsShared/Graphics/siteintercept/wr-dialog-close-btn-black.png" },
  ];

  // Traversal order matters: the 658 copy is reached before the 1080 one.
  const apiJson = {
    packageData: { accommodation: { imageUrl: TUN_12 + size(658, 370), imageUrls: [TUN_13 + size(488, 274)] } },
    packageViewData: { accomViewData: [{ accomImageUrl: TUN_12 + size(1080, 608) }] },
  };

  const gallery = () =>
    runExtractionSpec(spec, { title: "", text: "x".repeat(300), url: PAGE, images, apiJson }, "x").hotel_images;

  it("keeps the 1080 hero, not the 658 copy that was seen first", () => {
    const tun12 = gallery().find((s) => s.includes("TUN_12"));
    expect(tun12).toContain("width:1080");
  });

  it("counts each photo once across its four sizes", () => {
    expect(gallery().filter((s) => s.includes("TUN_12"))).toHaveLength(1);
    expect(gallery()).toHaveLength(2); // TUN_12 + TUN_13
  });

  it("drops the survey widget, the logo, the placeholder and the pictogram", () => {
    expect(gallery().every((s) => s.includes("content.tui.co.uk"))).toBe(true);
  });
});

// easyJet's slider: every image goes through the site's own /_next/image proxy,
// so page chrome, CMS marketing tiles and the hotel photography all share ONE
// host. imageUrlIncludes names the photo bucket so the gallery is chosen by
// where the photo really lives rather than by guessing the dominant host.
describe("easyJet gallery pinned by imageUrlIncludes", () => {
  const PAGE = "https://www.easyjet.com/en/holidays/turkey/marmaris/a-hotel";
  const P = "https://www.easyjet.com/holidays/_next/image?url=";
  const S3 = "https%3A%2F%2Fejh-web-prod-images.s3-eu-west-1.amazonaws.com%2F";
  const spec = { version: 1, fields: {}, imageUrlIncludes: "ejh-web-prod-images" } as unknown as ExtractionSpec;

  const photo = (hotel: string, n: string, w: number) =>
    `${P}${S3}${hotel}%2FLarge%2F${hotel.split("_")[0]}_${n}.jpg&w=${w}&q=75`;

  const images = [
    // The container's CSS background is a CMS placeholder; its inner url= is
    // RELATIVE, so unwrapping leaves it on the page's own host.
    { src: `${P}%2Fholidays%2Fcms%2Fmedia%2F-%2Fjssmedia%2Fc7aabef6.ashx%3Fmw%3D500&w=1920&q=75` },
    // The slide, as srcset advertises it — the widest is what should survive.
    { src: photo("TRDL0125_Club_Viva_Hotel", "11", 640) },
    { src: photo("TRDL0125_Club_Viva_Hotel", "11", 1920) },
    { src: photo("TRDL0125_Club_Viva_Hotel", "11", 3840) },
    { src: photo("TRDL0125_Club_Viva_Hotel", "12", 3840) },
    { src: "https://www.easyjet.com/holidays/cms/media/-/jssmedia/logo/a-logo.svg" },
  ];

  const gallery = () =>
    runExtractionSpec(spec, { title: "", text: "x".repeat(300), url: PAGE, images }, "x").hotel_images;

  it("keeps only the photo-bucket images", () => {
    expect(gallery()).toHaveLength(2);
    expect(gallery().every((s) => s.includes("ejh-web-prod-images"))).toBe(true);
  });

  it("keeps the widest variant of a slide, not the first seen", () => {
    const eleven = gallery().find((s) => s.includes("_11.jpg"));
    expect(eleven).toContain("w=3840");
  });

  it("never lets the CMS placeholder or the logo through", () => {
    expect(gallery().some((s) => /jssmedia|logo/i.test(s))).toBe(false);
  });
});

// An easyJet hotel page runs the property carousel AND one carousel per room
// card, every image from the same S3 bucket through the same /_next/image
// proxy. Neither imageUrlIncludes nor the dominant-host heuristic can separate
// them — a bedroom shot and a pool shot are indistinguishable by URL. Only
// where they sit in the page tells them apart, so the capture reports each
// image's surrounding class names / data-tids and the spec names the container.
describe("gallery scoped to a container", () => {
  const PAGE = "https://www.easyjet.com/en/holidays/turkey/marmaris/a-hotel";
  const P = "https://www.easyjet.com/holidays/_next/image?url=";
  const S3 = "https%3A%2F%2Fejh-web-prod-images.s3-eu-west-1.amazonaws.com%2FTRDL0125_Club_Viva_Hotel%2F";
  const photo = (folder: string, file: string) => `${P}${S3}${folder}%2F${file}.jpg&w=3840&q=75`;

  // Verbatim from the page: the property carousel, then a room card's slider.
  const HOTEL_CTX = "image-gallery-slide center HotelImageCarousel_wrapper__DxsZe hotel-main-view img-slider-box";
  const ROOM_CTX = "image-gallery-slide center OfferCardSlider_container__ZOmt_ room-card-img room-section";

  const images = [
    { src: photo("Large", "TRDL0125_00"), context: HOTEL_CTX },
    { src: photo("Large", "TRDL0125_11"), context: HOTEL_CTX },
    { src: photo("Medium", "DB01_03"), context: ROOM_CTX },
    { src: photo("Medium", "DB01_04"), context: ROOM_CTX },
    { src: photo("Medium", "FM01_01"), context: ROOM_CTX },
  ];

  const gallery = (spec: Partial<ExtractionSpec>, imgs = images) =>
    runExtractionSpec({ version: 1, fields: {}, ...spec } as ExtractionSpec, { title: "", text: "x".repeat(300), url: PAGE, images: imgs }, "x")
      .hotel_images;

  it("keeps the property carousel and drops the room cards", () => {
    const out = gallery({ imageUrlIncludes: "ejh-web-prod-images", imageContainerIncludes: "hotel-main-view" });
    expect(out).toHaveLength(2);
    expect(out.some((s) => /DB01|FM01/.test(s))).toBe(false);
  });

  it("without the container rule, the room photos come through — the bug", () => {
    expect(gallery({ imageUrlIncludes: "ejh-web-prod-images" })).toHaveLength(5);
  });

  // A pre-v9 capture carries no contexts. Emptying the gallery would be a far
  // worse failure than including a few room shots.
  it("is ignored when the capture has no contexts", () => {
    const noContext = images.map((i) => ({ src: i.src }));
    expect(gallery({ imageContainerIncludes: "hotel-main-view" }, noContext)).toHaveLength(5);
  });

  it("is ignored when the named container matches nothing", () => {
    expect(gallery({ imageContainerIncludes: "a-container-that-no-longer-exists" })).toHaveLength(5);
  });

  // easyJet's slider is VIRTUALISED — three <img> exist at a time, so most of
  // its gallery arrives from the booking JSON instead of the DOM. Those images
  // never sat anywhere on the page, so they carry no context and a rule about
  // where an image was must not judge them. Filtering them out alongside the
  // room cards would cut the supplier from ~20 photos to 3.
  it("never discards images that came from the booking JSON", () => {
    // Booking JSON holds DIRECT urls, not ones wrapped in the site's image
    // proxy — imagesFromJson only recognises a url ending in an image
    // extension, so a proxied "?url=…jpg&w=3840" is not harvested from there.
    const bucket = "https://ejh-web-prod-images.s3-eu-west-1.amazonaws.com/TRDL0125_Club_Viva_Hotel/Small/";
    const fromJson = {
      packageData: [`${bucket}TRDL0125_13.jpg`, `${bucket}TRDL0125_14.jpg`, `${bucket}TRDL0125_15.jpg`],
    };
    const out = runExtractionSpec(
      { version: 1, fields: {}, imageContainerIncludes: "hotel-main-view" } as unknown as ExtractionSpec,
      { title: "", text: "x".repeat(300), url: PAGE, images, apiJson: fromJson },
      "x",
    ).hotel_images;

    // 2 from the hotel carousel + 3 from the JSON; the 3 room-card shots go.
    expect(out).toHaveLength(5);
    expect(out.filter((s) => /TRDL0125_1[345]/.test(s))).toHaveLength(3);
    expect(out.some((s) => /DB01|FM01/.test(s))).toBe(false);
  });
});

// Regression: TUI serves photos from BOTH content.tui.co.uk and cdn.images.tui,
// depending on the deal. Pinning imageUrlIncludes to one host didn't fall back
// to the auto-detect — it selected that host's few stragglers and threw the real
// gallery away, so a 35-slide hotel imported with two images.
describe("a supplier with more than one image host", () => {
  const PAGE = "https://retailagents.tui.co.uk/retail/bookaccommodation?productCode=013537";
  const CDN = "https://cdn.images.tui/tui-images/";
  const OLD = "https://content.tui.co.uk/adamtui/2018_4/19_9/aaa/";
  const q = "?crop=edges&fit=crop&w=1080&h=608&q=70&auto=format";

  // This deal's gallery is on cdn.images.tui; one stray destination shot is on
  // the other host.
  const images = [
    { src: `${CDN}c88a43562fa5ee659d10fd6970dbe939.jpg${q}` },
    { src: `${CDN}d99b54673fb6ff760e21ge7081ecf040.jpg${q}` },
    { src: `${CDN}e00c65784gc7gg871f32hf8192fdg151.jpg${q}` },
    { src: `${OLD}TUN_HAM_F048WebOriginalCompressed.jpg${q}` },
    { src: "https://www.tui.co.uk/static-images/_ui/mobile/framework/tui-light/image_coming_soon.png" },
  ];

  const gallery = (imageUrlIncludes?: string) =>
    runExtractionSpec(
      { version: 1, fields: {}, ...(imageUrlIncludes ? { imageUrlIncludes } : {}) } as unknown as ExtractionSpec,
      { title: "", text: "x".repeat(300), url: PAGE, images },
      "x",
    ).hotel_images;

  it("finds the whole gallery with no imageUrlIncludes at all", () => {
    expect(gallery()).toHaveLength(4);
  });

  it("pinning ONE host is what broke it", () => {
    expect(gallery("content.tui.co.uk")).toHaveLength(1);
  });

  it("pipe-separated alternatives cover both hosts", () => {
    expect(gallery("content.tui.co.uk|cdn.images.tui")).toHaveLength(4);
  });

  it("a plain substring with no pipe still behaves as before", () => {
    expect(gallery("cdn.images.tui")).toHaveLength(3);
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

// Regression: an easyJet trade-portal capture imported with an empty
// travel_date. The portal names its dates "from"/"to" — which dateFromUrl did
// not recognise — and the stored spec's own travel_date rule missed the page's
// "LBA Sun 25th Oct 2026 - 08:45" summary line, so both sources came back
// empty even though the itinerary block stated the date plainly.
describe("travel_date fallbacks", () => {
  const EJ_URL =
    "https://www.easyjet.com/en/holidays/trade-portal/spain/costa-del-sol/torremolinos/sandos-griego" +
    "?ibf=true&to=01-11-2026&from=25-10-2026&flex=0&org=NCL,LBA&rooms=2_2:8|8&boardType=AI";

  // A spec whose travel_date rule doesn't match this page.
  const EJ_SPEC: ExtractionSpec = {
    version: 1,
    constants: { tour_operator: "easyJet holidays", currency: "GBP" },
    fields: {
      travel_date: { from: "text", regex: "Departing (\d{1,2} [A-Za-z]{3} \d{4})", group: 1, transform: "date" },
      no_of_nights: { from: "text", regex: "(\d+) nights", group: 1, transform: "number" },
    },
  } as ExtractionSpec;

  const ITINERARY = [
    "Your flights",
    "Sun 25th Oct 2026",
    "EJU7016",
    "08:45",
    "12:45",
    "Leeds Bradford",
    "(LBA)",
    "Malaga",
    "(AGP)",
    "Sun 1st Nov 2026",
    "EJU7015",
    "07:30",
    "09:35",
    "Malaga",
    "(AGP)",
    "Leeds Bradford",
    "(LBA)",
  ].join("\n");

  const EJ_TEXT = ["Torremolinos, Sandos Griego", "All Inclusive", "7 nights", "£2,006", ITINERARY].join("\n");

  it("reads the outbound date from a from=/to= deal URL", () => {
    const q = runExtractionSpec(
      EJ_SPEC,
      { title: "Hotel Details", text: EJ_TEXT, url: EJ_URL },
      "2026-08-21T00:00:00Z",
    );
    expect(q.travel_date).toBe("2026-10-25");
    expect(q.check_in_date_time).toBe("2026-10-25"); // derived from travel_date
  });

  it("falls back to the outbound flight when the URL carries no date either", () => {
    const q = runExtractionSpec(
      EJ_SPEC,
      { title: "Hotel Details", text: EJ_TEXT, url: "https://www.easyjet.com/en/holidays/trade-portal/x?ibf=true" },
      "2026-08-21T00:00:00Z",
    );
    expect(q.travel_date).toBe("2026-10-25");
  });

  it("does not mistake a from= route parameter for a date", () => {
    const q = runExtractionSpec(
      { version: 1, constants: {}, fields: {} } as ExtractionSpec,
      { title: "", text: "no itinerary here", url: "https://example.com/deal?from=LBA&to=AGP" },
      "2026-08-21T00:00:00Z",
    );
    expect(q.travel_date).toBe("");
  });
});

// A basket page that prints each leg as one sentence (Vista / Hays-shaped).
// None of the card / stacked / modal parsers fit it, so flights imported with
// no dates or times at all.
describe("inline prose flight legs", () => {
  const spec = { version: 1, fields: {} } as unknown as ExtractionSpec;

  const VISTA_TEXT = [
    "Basket Reference: BDG8YY",
    "Flights",
    "Manchester to Denpasar/Bali, Return, 2 Adults",
    "Outbound: Depart MAN 17th Jun 2027, 18:40, Arrive DPS 19th Jun 2027, 00:05 | Flying with: Swiss International (LX381) - Economy class",
    "Inbound: Depart DPS 28th Jun 2027, 13:20, Arrive MAN 29th Jun 2027, 08:15 | Flying with: Singapore Airlines (SQ939) - Economy class",
    "Accommodation",
    "Hard Rock Hotel Bali, Kuta/ Legian, 2 Adults",
    "TOTAL HOLIDAY COST",
    "£2613.69",
  ].join("\n");

  const q = runExtractionSpec(spec, { title: "VISTA", text: VISTA_TEXT, url: "https://x.test/itinerary.pl" }, "x");

  it("reads both legs' dates and times", () => {
    const [out, ret] = q.flights;
    expect(out.departure_date_time).toBe("2027-06-17T18:40");
    // The arrival states its own (next-day) date — it is not borrowed from the
    // departure the way single-date layouts have to.
    expect(out.arrival_date_time).toBe("2027-06-19T00:05");
    expect(ret.departure_date_time).toBe("2027-06-28T13:20");
    expect(ret.arrival_date_time).toBe("2027-06-29T08:15");
  });

  it("reads the airport codes, names and flight numbers", () => {
    const [out, ret] = q.flights;
    expect(out.departing_airport).toBe("MAN");
    expect(out.arrival_airport).toBe("DPS");
    expect(out.departing_airport_name).toBe("Manchester");
    expect(out.arrival_airport_name).toBe("Denpasar/Bali");
    expect(out.flight_number).toBe("LX381");
    expect(ret.departing_airport).toBe("DPS");
    expect(ret.arrival_airport).toBe("MAN");
    expect(ret.flight_number).toBe("SQ939");
  });

  it("takes travel_date off the outbound leg when nothing else names it", () => {
    expect(q.travel_date).toBe("2027-06-17");
  });

  it("does not hijack the stacked-itinerary or OUT/RTN layouts", () => {
    const stacked = [
      "Fri 14th Aug 2026", "EZY2051", "17:00", "23:25",
      "Manchester", "(MAN)", "Rhodes, Diagoras", "(RHO)",
      "Fri 21st Aug 2026", "EZY2052", "06:00", "10:20",
      "Rhodes, Diagoras", "(RHO)", "Manchester", "(MAN)",
    ].join("\n");
    const s = runExtractionSpec(spec, { title: "", text: stacked, url: "https://x.test/d" }, "x");
    expect(s.flights[0].departure_date_time).toBe("2026-08-14T17:00");
    expect(s.flights[0].flight_number).toBe("EZY2051");
  });
});

// A cruise-line checkout summary (Royal Caribbean-shaped). It carries no
// flights and no "checkin" param, so the deal's date, length and party size all
// have to come from conventions the interpreter already owns.
describe("cruise checkout fallbacks", () => {
  const spec = { version: 1, fields: {} } as unknown as ExtractionSpec;

  const RCCL_URL =
    "https://www.royalcaribbean.com/gbr/en/checkout/summary?groupId=FR05STH-1158403524&sailDate=2027-06-21&shipCode=FR&cabinClassType=INTERIOR&roomIndex=0&r0a=2&r0c=0&r0b=n&r0d=INTERIOR&r0A=1102&r0p=M";
  const RCCL_TITLE = "5-night Hamburg & Rotterdam Cruise | Summary | Royal Caribbean Cruises";
  const RCCL_TEXT = [
    "5-Night Hamburg & Rotterdam Cruise",
    "Leaving from", "Southampton, England",
    "Onboard", "Freedom of the Seas",
    "Dates", "21 Jun 2027", "26 Jun 2027",
    "Guests", "2 Adults",
    "Trip total", "£1,102.00 GBP",
  ].join("\n");

  const q = runExtractionSpec(spec, { title: RCCL_TITLE, text: RCCL_TEXT, url: RCCL_URL }, "x");

  it("dates the deal from the sailing param, whatever its casing", () => {
    expect(q.travel_date).toBe("2027-06-21");
    expect(q.check_in_date_time).toBe("2027-06-21");
  });

  it("reads the length from the '5-Night …' wording", () => {
    expect(q.no_of_nights).toBe(5);
  });

  it("ignores a plural duration picker, which lists options nobody chose", () => {
    const picker = ["Durations", "2 nights", "-£206pp", "6 nights"].join("\n");
    const p = runExtractionSpec(spec, { title: "", text: picker, url: "https://x.test/d" }, "x");
    expect(p.no_of_nights).toBe(0);
  });

  it("reads party size from indexed room params, not the capitalised price key", () => {
    const url = RCCL_URL.replace("r0a=2", "r0a=3").replace("r0c=0", "r0c=1");
    const p = runExtractionSpec(spec, { title: RCCL_TITLE, text: RCCL_TEXT, url }, "x");
    expect(p.adults).toBe(3); // not 1102 from "r0A=1102"
    expect(p.children).toBe(1);
  });
});

// The day-by-day ports sit in a "View Ports" drawer as a Day/Port table. No
// field rule can reach a repeating table, and the spec's itineraryRegex is
// AI-written from one example — so the shape is read supplier-neutrally.
describe("cruise itinerary table", () => {
  const CRUISE_TEXT = [
    "5-Night Hamburg & Rotterdam Cruise",
    "Leaving from", "Southampton, England",
    "Onboard", "Freedom of the Seas",
    "Dates", "21 Jun 2027", "26 Jun 2027",
    "View Ports",
    "Itinerary",
    "Day\tPort",
    "1\t", "Southampton, England", "Departs at 5:00 pm", "",
    "2\t", "Cruising", "Day at Sea", "",
    "3\t", "Hamburg, Germany", "From 7:00 am - 4:00 pm", "",
    "4\t", "Rotterdam, Netherlands", "From 10:30 am - 9:00 pm", "",
    "5\t", "Cruising", "Day at Sea", "",
    "6\t", "Southampton, England", "Arrives at 5:30 am", "",
    "* A cruising experience with us provides access to a range of destinations.",
  ].join("\n");

  // What a cruise line's own spec carries: operator + currency, no cruise rules.
  const spec = {
    version: 1,
    constants: { tour_operator: "Royal Caribbean", currency: "GBP" },
    fields: {},
  } as unknown as ExtractionSpec;
  const CTX = { title: "", text: CRUISE_TEXT, url: "https://www.royalcaribbean.com/checkout/summary?sailDate=2027-06-21" };

  it("reads every day, its port and the times beneath it", () => {
    const q = runExtractionSpec(spec, CTX, "x");
    expect(q.itinerary).toHaveLength(6);
    expect(q.itinerary?.[0]).toEqual({ day: 1, description: "Southampton, England", sub_description: "Departs at 5:00 pm" });
    expect(q.itinerary?.[2]).toEqual({ day: 3, description: "Hamburg, Germany", sub_description: "From 7:00 am - 4:00 pm" });
    expect(q.itinerary?.[5].day).toBe(6);
    // The trailing disclaimer is not a port.
    expect(JSON.stringify(q.itinerary)).not.toContain("cruising experience with us");
  });

  it("treats the port table as cruise evidence when the spec has no cruise rules", () => {
    const q = runExtractionSpec(spec, CTX, "x");
    expect(q.ship_name).toBe("Freedom of the Seas");
    expect(q.cruise_line).toBe("Royal Caribbean");
    expect(q.embarkation).toBe("Southampton, England");
    expect(q.debarkation).toBe("Southampton, England"); // the last day's port
    expect(q.cruise_date).toBe("2027-06-21");
  });

  it("still prefers the spec's own itineraryRegex", () => {
    const withRegex = { ...spec, itineraryRegex: String.raw`Day (\d+)\s*[-–]\s*(.+)` } as unknown as ExtractionSpec;
    const text = `${CRUISE_TEXT}\nDay 1 - Dover, England\nDay 2 - Bruges, Belgium`;
    const q = runExtractionSpec(withRegex, { ...CTX, text }, "x");
    expect(q.itinerary).toHaveLength(2);
    expect(q.itinerary?.[0].description).toBe("Dover, England");
  });

  it("does not read a page's stray numbers as an itinerary", () => {
    const notACruise = ["Durations", "2", "-£206pp", "6", "nights", "Onboard", "Wi-Fi"].join("\n");
    const q = runExtractionSpec(spec, { title: "", text: notACruise, url: "https://x.test/d" }, "x");
    expect(q.itinerary).toBeUndefined();
    expect(q.ship_name).toBeUndefined(); // and the deal is not turned into a cruise
  });
});

// A cruise has one date: the sailing. cruise_date and travel_date must agree,
// whichever of them the page states and however it writes it.
describe("cruise date is the travel date", () => {
  const CRUISE_TEXT = [
    "Leaving from", "Southampton, England",
    "Onboard", "Freedom of the Seas",
    "Day\tPort",
    "1\t", "Southampton, England", "Departs at 5:00 pm", "",
    "2\t", "Cruising", "Day at Sea", "",
    "3\t", "Hamburg, Germany", "From 7:00 am - 4:00 pm", "",
  ].join("\n");

  const specWith = (fields: Record<string, unknown>) =>
    ({ version: 1, constants: { tour_operator: "Royal Caribbean" }, fields }) as unknown as ExtractionSpec;

  it("normalises a sail date written in the page's own wording and travels on it", () => {
    // No transform:'date' on the rule, so the raw capture is "21 Jun 2027" —
    // which the form's date field could not read.
    const spec = specWith({ cruise_date: { from: "text", regex: "Sails (.+)", group: 1 } });
    const q = runExtractionSpec(spec, { title: "", text: `Sails 21 Jun 2027\n${CRUISE_TEXT}`, url: "https://x.test/d" }, "x");
    expect(q.cruise_date).toBe("2027-06-21");
    expect(q.travel_date).toBe("2027-06-21");
    expect(q.check_in_date_time).toBe("2027-06-21");
  });

  it("keeps the two in step when only the travel date is known", () => {
    const q = runExtractionSpec(specWith({}), { title: "", text: CRUISE_TEXT, url: "https://x.test/d?sailDate=2027-06-21" }, "x");
    expect(q.travel_date).toBe("2027-06-21");
    expect(q.cruise_date).toBe(q.travel_date);
  });

  it("lets the sailing win when a page states both", () => {
    const spec = specWith({
      travel_date: { from: "text", regex: String.raw`Book by ([\d-]+)`, group: 1 },
      cruise_date: { from: "text", regex: String.raw`Sails ([\d-]+)`, group: 1 },
    });
    const text = `Book by 2027-04-12\nSails 2027-06-21\n${CRUISE_TEXT}`;
    const q = runExtractionSpec(spec, { title: "", text, url: "https://x.test/d" }, "x");
    expect(q.cruise_date).toBe("2027-06-21");
    expect(q.travel_date).toBe("2027-06-21");
  });
});

// An overnight port call is printed as ONE row spanning two days ("8 - 9").
describe("cruise itinerary day ranges", () => {
  const spec = {
    version: 1,
    constants: { tour_operator: "Royal Caribbean" },
    fields: {},
  } as unknown as ExtractionSpec;

  const OVERNIGHT_TEXT = [
    "Onboard", "Freedom of the Seas",
    "Day\tPort",
    "1\t", "Southampton, England", "Departs at 5:00 pm", "",
    "2\t", "Cruising", "Day at Sea", "",
    "3\t", "Hamburg, Germany", "From 7:00 am - 4:00 pm", "",
    "4 - 5", "Amsterdam, Netherlands", "Overnight in port", "",
    "6\t", "Cruising", "Day at Sea", "",
    "7\t", "Southampton, England", "Arrives at 5:30 am", "",
  ].join("\n");

  const q = runExtractionSpec(spec, { title: "", text: OVERNIGHT_TEXT, url: "https://x.test/d?sailDate=2027-06-21" }, "x");

  it("reads a range as its own days, never as one crushed number", () => {
    const days = q.itinerary?.map((d) => d.day);
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days).not.toContain(45);
  });

  it("puts the overnight port on both of its days", () => {
    expect(q.itinerary?.[3]).toEqual({ day: 4, description: "Amsterdam, Netherlands", sub_description: "Overnight in port" });
    expect(q.itinerary?.[4]).toEqual({ day: 5, description: "Amsterdam, Netherlands", sub_description: "Overnight in port" });
  });

  it("keeps reading the days that follow a range", () => {
    // The run used to break at the range and drop everything after it.
    expect(q.itinerary?.[6]).toEqual({ day: 7, description: "Southampton, England", sub_description: "Arrives at 5:30 am" });
  });

  // A row also prints an unbroken block of SEA DAYS, and an ocean crossing is
  // long — Cunard writes a transatlantic as "Day 7-13". Capped at 3 days, that
  // collapsed to day 7 alone, and because the days after it no longer followed
  // on, everything past it was dropped: a 28-day voyage ended at day 7.
  it("keeps a long block of sea days, and the itinerary that follows it", () => {
    const spec = {
      version: 1,
      constants: { cruise_line: "Cunard", ship_name: "Queen Elizabeth" },
      fields: {},
      itineraryRegex: String.raw`Day\s*(\d+(?:-\d+)?)\s*\n([^\n]+)`,
    } as unknown as ExtractionSpec;
    const text = [
      "Day", "1", "Barcelona, Spain",
      "Day", "2", "At sea",
      "Day", "3-9", "At sea",
      "Day", "10", "Miami, FL, USA",
    ].join("\n");
    const q = runExtractionSpec(spec, { title: "", text, url: "https://x.test/d?sailDate=2027-10-29" }, "x");
    expect(q.itinerary?.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(q.itinerary?.[8]).toEqual({ day: 9, description: "At sea" });
    // The day after the block still reads, which is what used to be lost.
    expect(q.itinerary?.[9]).toEqual({ day: 10, description: "Miami, FL, USA" });
  });

  it("still refuses a range too long to be one row", () => {
    const spec = {
      version: 1,
      constants: { cruise_line: "Cunard", ship_name: "Queen Elizabeth" },
      fields: {},
      itineraryRegex: String.raw`Day\s*(\d+(?:-\d+)?)\s*\n([^\n]+)`,
    } as unknown as ExtractionSpec;
    const q = runExtractionSpec(spec, {
      title: "",
      text: ["Day", "1-99", "At sea"].join("\n"),
      url: "https://x.test/d?sailDate=2027-10-29",
    }, "x");
    expect(q.itinerary).toHaveLength(1);
    expect(q.itinerary?.[0].day).toBe(1);
  });

  it("expands a range the spec's own itineraryRegex captured", () => {
    const withRegex = {
      version: 1,
      // A spec that names the cruise itself, so detection doesn't lean on the
      // port table this page doesn't have.
      constants: { cruise_line: "Royal Caribbean", ship_name: "Freedom of the Seas" },
      fields: {},
      itineraryRegex: String.raw`Days? ([\d\s–-]+?):\s*(.+)`,
    } as unknown as ExtractionSpec;
    const text = ["Day 1: Dover", "Days 2-3: Bruges", "Day 4: Dover"].join("\n");
    const r = runExtractionSpec(withRegex, { title: "", text, url: "https://x.test/d?sailDate=2027-06-21" }, "x");
    expect(r.itinerary?.map((d) => d.day)).toEqual([1, 2, 3, 4]);
    expect(r.itinerary?.[2]).toEqual({ day: 3, description: "Bruges" });
  });
});

// A cruise checkout that prints NO day-by-day itinerary — Virgin Voyages'
// summary page states the ship, the sailing and the cabin and nothing else.
// Detection hung on the spec's ship_name regex alone: neither supplier-neutral
// fallback ran without a port table, so when that one AI-written regex missed
// the whole cruise block vanished and the deal imported as a package holiday.
describe("cruise page with no port table", () => {
  const VIRGIN_TEXT = [
    "Your Voyage",
    "Southern Caribbean &",
    "  Aruban Nights",
    "£2,065.10 (Includes taxes & fees)",
    "",
    "7 NIGHTS",
    "",
    "•",
    "",
    "VALIANT LADY",
    "",
    "Southern Caribbean & Aruban Nights",
    "",
    "Round trip from San Juan, Puerto Rico, USA",
    "The Insider",
    "2 sailors",
  ].join("\n");
  const URL = "https://www.virginvoyages.com/book/voyage-planner/summary?currencyCode=GBP&dateFrom=2027-03-01";

  // The ship rule as the AI first wrote it: pinned to ONE voyage's name, and
  // blind to the blank line the page puts between the ship and that name.
  const brokenShipRule = { from: "text", regex: String.raw`([A-Z ]+)\nSouthern Caribbean & Aruban Nights`, group: 1 };
  const specWithBrokenShip = {
    version: 1,
    constants: { tour_operator: "Virgin Voyages", currency: "GBP" },
    fields: {
      ship_name: brokenShipRule,
      cruise_line: { from: "text", fallback: "Virgin Voyages" },
      embarkation: { from: "text", regex: String.raw`Round trip from ([^,\n]+)`, group: 1 },
    },
  } as unknown as ExtractionSpec;

  it("is still a cruise when the spec's ship rule misses", () => {
    const q = runExtractionSpec(specWithBrokenShip, { title: "", text: VIRGIN_TEXT, url: URL }, "x");
    // Both keys present is what routes the deal to the client's cruise importer.
    expect(q.cruise_line).toBe("Virgin Voyages");
    expect(q.ship_name).toBeDefined();
    expect(q.embarkation).toBe("San Juan");
    expect(q.cruise_date).toBe(q.travel_date);
  });

  it("reads the ship once the spec's rule is anchored structurally", () => {
    const fixed = {
      ...specWithBrokenShip,
      fields: {
        ...specWithBrokenShip.fields,
        // Anchored on the page's SHAPE — the line after the nights/bullet
        // header — so the next voyage on a different ship still reads.
        ship_name: { from: "text", regex: String.raw`\d+\s*NIGHTS\s*\n+\s*(?:[•·|-]\s*\n+\s*)?([^\n]+)`, group: 1 },
      },
    } as unknown as ExtractionSpec;
    const q = runExtractionSpec(fixed, { title: "", text: VIRGIN_TEXT, url: URL }, "x");
    expect(q.ship_name).toBe("VALIANT LADY");
    expect(q.cruise_line).toBe("Virgin Voyages");
  });

  it("reads a ship labelled 'On Board', as Royal Caribbean spells it", () => {
    const text = [
      "Leaving from", "Southampton, England",
      "On Board", "Freedom of the Seas",
      "Dates", "9 May 2027",
    ].join("\n");
    const spec = {
      version: 1,
      constants: { tour_operator: "Royal Caribbean" },
      // Declares cruise fields, so the page is a cruise even with no port table.
      fields: { cabin_type: { from: "text", regex: String.raw`We choose your ([A-Za-z ]+)`, group: 1 } },
    } as unknown as ExtractionSpec;
    const q = runExtractionSpec(spec, { title: "", text, url: "https://x.test/d?sailDate=2027-05-09" }, "x");
    expect(q.ship_name).toBe("Freedom of the Seas");
    expect(q.embarkation).toBe("Southampton, England");
  });

  // US portals write the month first. A month-first date used to parse to
  // nothing, so the field was dropped as un-ISO and the date fell back to a URL
  // parameter — and Carnival's "sailDate=07022027" is MMDDYYYY, read there as
  // DDMMYYYY. A 2 July sailing was imported as 7 February.
  it("reads a month-first sailing date instead of falling back to the URL", () => {
    const spec = {
      version: 1,
      constants: { cruise_line: "Carnival", ship_name: "Carnival Conquest" },
      fields: {
        cruise_date: {
          from: "text",
          group: 2,
          regex: String.raw`(Fri|Mon|Tue|Wed|Thu|Sat|Sun)\s+([A-Za-z]{3}\s+\d{2},\s+\d{4})`,
          transform: "date",
        },
      },
    } as unknown as ExtractionSpec;
    const q = runExtractionSpec(spec, {
      title: "",
      text: "Ship: Carnival Conquest\nFri Jul 02, 2027 - Mon Jul 05, 2027",
      url: "https://www.carnival.com/booking/review?sailDate=07022027",
    }, "x");
    expect(q.cruise_date).toBe("2027-07-02");
    expect(q.travel_date).toBe("2027-07-02");
  });

  it("still reads a day-first date the other way round", () => {
    const spec = {
      version: 1,
      constants: { cruise_line: "Royal Caribbean", ship_name: "Freedom of the Seas" },
      fields: { cruise_date: { from: "text", group: 1, regex: String.raw`Dates?\s*\n+\s*(\d{1,2} [A-Za-z]{3,9} \d{4})`, transform: "date" } },
    } as unknown as ExtractionSpec;
    const q = runExtractionSpec(spec, { title: "", text: "Dates\n9 May 2027", url: "https://x.test/d" }, "x");
    expect(q.cruise_date).toBe("2027-05-09");
  });

  it("leaves a page whose spec claims no cruise fields alone", () => {
    // Same shape of page, but a spec written for a package holiday. Nothing
    // here should invent a sailing.
    const packageSpec = {
      version: 1,
      constants: { tour_operator: "Some Portal", currency: "GBP" },
      fields: { accommodation: { from: "text", regex: String.raw`^([^\n]+)`, group: 1 } },
    } as unknown as ExtractionSpec;
    const q = runExtractionSpec(packageSpec, { title: "", text: VIRGIN_TEXT, url: URL }, "x");
    expect(q.cruise_line).toBeUndefined();
    expect(q.ship_name).toBeUndefined();
  });
});
