import type { UseFormReturn } from "react-hook-form";
import type { QueryClient } from "@tanstack/react-query";
import type { JsonMappingResult } from "@/features/json-mapper/api/json-mapper.api";
import { normalizeTransferType } from "@/features/quote/types/quote-form.types";

type AirportRecord = { id: string; airport_name: string; airport_code?: string | null };
type PackageTypeRecord = { id: string; name: string };

export interface JsonImportDeps {
  form: UseFormReturn<any>;
  airportsData: AirportRecord[] | undefined;
  packageTypesData: PackageTypeRecord[] | undefined;
  queryClient: QueryClient;
  lookupKeys: { parks: readonly unknown[]; lodges: (id: string) => readonly unknown[] };
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  setImageUrls?: (updater: (prev: string[]) => string[]) => void;
  skipLodgeResetRef?: React.MutableRefObject<boolean>;
  fallbackFieldMapper?: (data: Record<string, any>, setIfPresent: (key: string, val: unknown) => void, toIsoDate: (d: string | undefined) => string) => void;
}

function toIsoDate(d: string | undefined): string {
  if (!d) return "";
  const match = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return d;
}

function isCruiseFormat(data: Record<string, any>): boolean {
  if (data.cruise && typeof data.cruise === "object" && !Array.isArray(data.cruise)) return true;
  const hasLine = data.cruise_line ?? data.cruiseLine ?? data.cruise_company ?? data.cruiseCompany;
  const hasShip = data.ship_name ?? data.shipName ?? data.ship;
  return hasLine !== undefined && hasShip !== undefined;
}

function isScraperFormat(data: Record<string, any>): boolean {
  return (
    Array.isArray(data.flights) ||
    data.sales_price !== undefined ||
    data.departure_airport !== undefined ||
    data.lodge_id !== undefined ||
    data.lodge_type !== undefined ||
    data.lodge_code !== undefined ||
    data.lodge_park_name !== undefined ||
    data.cottage_id !== undefined ||
    data.hot_tub !== undefined ||
    data.pets !== undefined ||
    Array.isArray(data.lodge_images) ||
    data.board_basis_name !== undefined
  );
}

function resolveAirportId(airportText: string | undefined, airportsData: AirportRecord[] | undefined): string {
  if (!airportText || !airportsData) return "";
  const needle = airportText.trim().toLowerCase();
  if (!needle) return "";
  const exact = airportsData.find(
    (a) =>
      (a.airport_name || "").trim().toLowerCase() === needle ||
      (a.airport_code || "").trim().toLowerCase() === needle
  );
  if (exact) return exact.id;
  const partial = airportsData.find((a) => {
    const name = (a.airport_name || "").trim().toLowerCase();
    const code = (a.airport_code || "").trim().toLowerCase();
    return (
      name.includes(needle) ||
      needle.includes(name) ||
      (code.length > 0 && (code.includes(needle) || needle.includes(code)))
    );
  });
  return partial?.id || "";
}

// ── Line items (shared by the scraper and cruise import paths) ────────────────
// "Line items" = extra accommodations + transfers + car hire + attraction tickets
// + lounge passes + airport parking. They live in the JSON as arrays and map to
// the form's matching arrays. All name→id resolution (accommodation hierarchy,
// board basis, room type, tour operators, airports) happens server-side in the
// single mapToIds call — here we only read the raw rows and merge the ids back.
type LineItemRaw = {
  extraHotels: Record<string, any>[];
  transfers: Record<string, any>[];
  carHires: Record<string, any>[];
  attractionTickets: Record<string, any>[];
  loungePasses: Record<string, any>[];
  airportParkings: Record<string, any>[];
};

function collectLineItems(
  data: Record<string, any>,
  quoteLevel: { country?: string; destination?: string; resort?: string },
): { raw: LineItemRaw; input: Record<string, unknown> } {
  const arr = (...keys: string[]): Record<string, any>[] => {
    for (const k of keys) {
      if (Array.isArray(data[k])) return data[k] as Record<string, any>[];
    }
    return [];
  };
  // First hotel (or the one flagged is_primary) is the primary stay; the rest are extras.
  const hotels = Array.isArray(data.hotels) ? (data.hotels as Record<string, any>[]) : [];
  const primaryIdx = hotels.findIndex((h) => h?.is_primary === true);
  const extraHotels = hotels.filter((_, i) => i !== (primaryIdx === -1 ? 0 : primaryIdx));

  const raw: LineItemRaw = {
    extraHotels,
    transfers: arr("transfers"),
    carHires: arr("car_hire", "carHire", "carHires"),
    attractionTickets: arr("attraction_tickets", "attractionTickets"),
    loungePasses: arr("lounge_pass", "loungePasses"),
    airportParkings: arr("airport_parking", "airportParkings"),
  };

  const to = (x: Record<string, any>) => x.tour_operator ?? x.tourOperator;
  const ap = (x: Record<string, any>) => x.airport || x.airport_name || x.airport_code;

  // Name-only payloads the server resolves to ids (order preserved per array).
  const input = {
    extraAccommodations: extraHotels.map((h) => ({
      country: h.country || quoteLevel.country,
      destination: h.destination || quoteLevel.destination,
      resort: h.resort || quoteLevel.resort,
      accommodation: h.accommodation,
      boardBasis: h.board_basis,
      roomType: h.room_type,
      tourOperator: to(h),
    })),
    transfers: raw.transfers.map((t) => ({ tourOperator: to(t) })),
    carHires: raw.carHires.map((c) => ({ tourOperator: to(c) })),
    attractionTickets: raw.attractionTickets.map((a) => ({ tourOperator: to(a) })),
    loungePasses: raw.loungePasses.map((l) => ({ tourOperator: to(l), airport: ap(l) })),
    airportParkings: raw.airportParkings.map((p) => ({ tourOperator: to(p), airport: ap(p) })),
  };

  return { raw, input };
}

function applyLineItems(
  setValue: (name: any, value: any) => void,
  raw: LineItemRaw,
  idMapping: JsonMappingResult,
  queryClient: QueryClient,
): { counts: string[]; unresolvedHotels: string[] } {
  const num = (v: unknown, d = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  // Dates may arrive combined ("2027-02-05T15:00:00") or as separate date/time fields.
  const splitDateTime = (dt: unknown): { date: string; time: string } => {
    if (!dt) return { date: "", time: "" };
    const [datePart, timePart = ""] = String(dt).split("T");
    return { date: toIsoDate(datePart), time: timePart.slice(0, 5) };
  };
  const pickDateTime = (combined: unknown, dateVal: unknown, timeVal: unknown) => {
    if (combined) return splitDateTime(combined);
    return { date: dateVal ? toIsoDate(String(dateVal)) : "", time: timeVal ? String(timeVal).slice(0, 5) : "" };
  };
  const toDate = (v: unknown): string => (v ? toIsoDate(String(v).split("T")[0]) : "");

  const unresolvedHotels: string[] = [];

  if (raw.extraHotels.length) {
    const resolved = idMapping.extraAccommodations || [];
    setValue("extraAccommodations", raw.extraHotels.map((h, i) => {
      const r = resolved[i] || ({} as (typeof resolved)[number]);
      const { date, time } = splitDateTime(h.check_in_date_time || h.check_in_date);
      if (!r.accommodationId) unresolvedHotels.push(h.accommodation || "(unnamed hotel)");
      return {
        bookingRef: h.booking_ref || "",
        tourOperatorId: r.tourOperatorId || "",
        accommodationId: r.accommodationId || "",
        boardBasisId: r.boardBasisId || "",
        roomType: r.roomTypeId || "",
        checkInDate: date,
        checkInTime: time,
        noOfNights: num(h.no_of_nights),
        cost: num(h.cost),
        commission: num(h.commission),
        isIncludedInPackage: h.is_included_in_package ?? true,
      };
    }));

    // The extra-accommodation dropdown is a SearchableSelect that resolves its label
    // from its loaded options. With no search term and no resort scope it loads
    // nothing, so a freshly-imported id renders blank. Seed the unscoped search
    // cache (the exact key the field reads) with the id→name pairs we already have.
    const accomRows = raw.extraHotels
      .map((h, i) => {
        const id = resolved[i]?.accommodationId;
        return id ? { id, name: h.accommodation || id } : null;
      })
      .filter(Boolean) as { id: string; name: string }[];
    if (accomRows.length) {
      queryClient.setQueryData(
        ["lookup", "accommodations", "search", "", undefined, undefined, undefined],
        (old: unknown) => {
          const list = Array.isArray(old) ? (old as { id: string }[]) : [];
          const merged = [...list];
          for (const row of accomRows) if (!merged.some((x) => x.id === row.id)) merged.push(row);
          return merged;
        },
      );
    }
  }

  if (raw.transfers.length) {
    const resolved = idMapping.transfers || [];
    setValue("transfers", raw.transfers.map((t, i) => {
      const pu = pickDateTime(t.pick_up_date_time ?? t.pickup_date_time, t.pick_up_date ?? t.pickup_date, t.pick_up_time ?? t.pickup_time);
      const drop = pickDateTime(t.drop_off_date_time ?? t.dropoff_date_time, t.drop_off_date ?? t.dropoff_date, t.drop_off_time ?? t.dropoff_time);
      return {
        bookingRef: t.booking_ref || "",
        tourOperatorId: resolved[i]?.tourOperatorId || "",
        pickUpLocation: t.pick_up_location || t.pickup_location || "",
        dropOffLocation: t.drop_off_location || t.dropoff_location || "",
        pickUpDate: pu.date,
        pickUpTime: pu.time,
        dropOffDate: drop.date,
        dropOffTime: drop.time,
        note: t.note || "",
        cost: num(t.cost),
        commission: num(t.commission),
        isIncludedInPackage: t.is_included_in_package ?? true,
      };
    }));
  }

  if (raw.carHires.length) {
    const resolved = idMapping.carHires || [];
    setValue("carHires", raw.carHires.map((c, i) => {
      const pu = pickDateTime(c.pick_up_date_time, c.pick_up_date, c.pick_up_time);
      const drop = pickDateTime(c.drop_off_date_time, c.drop_off_date, c.drop_off_time);
      return {
        bookingRef: c.booking_ref || "",
        tourOperatorId: resolved[i]?.tourOperatorId || "",
        pickUpLocation: c.pick_up_location || "",
        dropOffLocation: c.drop_off_location || "",
        pickUpDate: pu.date,
        pickUpTime: pu.time,
        dropOffDate: drop.date,
        dropOffTime: drop.time,
        noOfDays: num(c.no_of_days, 1),
        driverAge: num(c.driver_age, 25),
        cost: num(c.cost),
        commission: num(c.commission),
        isIncludedInPackage: c.is_included_in_package ?? true,
      };
    }));
  }

  if (raw.attractionTickets.length) {
    const resolved = idMapping.attractionTickets || [];
    setValue("attractionTickets", raw.attractionTickets.map((a, i) => ({
      bookingRef: a.booking_ref || "",
      tourOperatorId: resolved[i]?.tourOperatorId || "",
      ticketType: a.ticket_type || a.type || "",
      dateOfVisit: toDate(a.date_of_visit),
      numberOfTickets: num(a.number_of_tickets, 1),
      cost: num(a.cost),
      commission: num(a.commission),
      isIncludedInPackage: a.is_included_in_package ?? true,
    })));
  }

  if (raw.loungePasses.length) {
    const resolved = idMapping.loungePasses || [];
    setValue("loungePasses", raw.loungePasses.map((l, i) => ({
      bookingRef: l.booking_ref || "",
      tourOperatorId: resolved[i]?.tourOperatorId || "",
      airportId: resolved[i]?.airportId || "",
      terminal: l.terminal || "",
      dateOfUsage: toDate(l.date_of_usage),
      note: l.note || "",
      cost: num(l.cost),
      commission: num(l.commission),
      isIncludedInPackage: l.is_included_in_package ?? true,
    })));
  }

  if (raw.airportParkings.length) {
    const resolved = idMapping.airportParkings || [];
    setValue("airportParkings", raw.airportParkings.map((p, i) => ({
      bookingRef: p.booking_ref || "",
      tourOperatorId: resolved[i]?.tourOperatorId || "",
      airportId: resolved[i]?.airportId || "",
      parkingType: p.parking_type || "",
      parkingDate: toDate(p.parking_date),
      carMake: p.car_make || "",
      carModel: p.car_model || "",
      colour: p.colour || p.color || "",
      carRegNumber: p.car_reg_number || "",
      duration: p.duration != null ? String(p.duration) : "",
      cost: num(p.cost),
      commission: num(p.commission),
      isIncludedInPackage: p.is_included_in_package ?? true,
    })));
  }

  // Board basis / room type / tour operator dropdowns read full-list caches; if the
  // import find-or-created any new rows, refresh those lists so the new ids resolve.
  const hasLineItems =
    raw.extraHotels.length || raw.transfers.length || raw.carHires.length ||
    raw.attractionTickets.length || raw.loungePasses.length || raw.airportParkings.length;
  if (hasLineItems) {
    queryClient.invalidateQueries({ queryKey: ["lookup", "board-basis"] });
    queryClient.invalidateQueries({ queryKey: ["lookup", "room-types"] });
    queryClient.invalidateQueries({ queryKey: ["tourOperators"] });
  }

  const plural = (n: number, s: string, suf = "s") => `${n} ${s}${n === 1 ? "" : suf}`;
  const counts: string[] = [];
  if (raw.extraHotels.length) counts.push(plural(raw.extraHotels.length, "extra hotel"));
  if (raw.transfers.length) counts.push(plural(raw.transfers.length, "transfer"));
  if (raw.carHires.length) counts.push(plural(raw.carHires.length, "car hire"));
  if (raw.attractionTickets.length) counts.push(plural(raw.attractionTickets.length, "attraction"));
  if (raw.loungePasses.length) counts.push(plural(raw.loungePasses.length, "lounge pass", "es"));
  if (raw.airportParkings.length) counts.push(plural(raw.airportParkings.length, "parking", ""));

  return { counts, unresolvedHotels };
}

async function handleScraperJson(data: Record<string, any>, deps: JsonImportDeps): Promise<void> {
  const { form, airportsData, packageTypesData, queryClient, lookupKeys, toast, setImageUrls, skipLodgeResetRef } = deps;
  const { setValue } = form;

  const { mapScraperJsonToFormFields } = await import("@/lib/scraper-json-parser");
  const { jsonMapperApi } = await import("@/features/json-mapper/api/json-mapper.api");

  const result = mapScraperJsonToFormFields(data);

  const hasLodgeFieldsInJson = !!(
    data.lodge_type ||
    data.lodge_code ||
    data.lodge_id ||
    data.lodge_park_name ||
    Array.isArray(data.lodge_images) ||
    data.cottage_id !== undefined ||
    data.hot_tub !== undefined ||
    data.pets !== undefined
  );
  const tourOp = (data.tour_operator || result.fields.tourOperator || "").toLowerCase().trim();
  const lodgeTourOperators = [
    "hoseasons", "haven", "parkdean", "park dean", "butlins",
    "center parcs", "centre parcs", "away resorts", "park holidays",
  ];
  const isLodgeTourOperator = lodgeTourOperators.some((op) => tourOp.includes(op));
  // Decide from the INCOMING scrape only — never from the form's current type, or
  // importing a package holiday after a lodge would stay stuck on Hot Tub Break.
  const isLodgeQuote = hasLodgeFieldsInJson || isLodgeTourOperator;

  const lodgeParkName = data.lodge_park_name || data.resort || result.fields.resort || "";
  const lodgeCodeVal = data.lodge_code || data.cottage_id || null;
  const lodgeName = data.accommodation || result.fields.accommodation || "";
  const parkCode = data.lodge_id || null;

  // Line items (extra hotels, transfers, etc.) are resolved in the SAME call.
  const { raw: lineItems, input: lineItemsInput } = collectLineItems(data, {
    country: result.fields.country,
    destination: result.fields.destination,
    resort: result.fields.resort,
  });

  const mappingInput: Record<string, unknown> = {
    country: result.fields.country,
    destination: result.fields.destination,
    resort: result.fields.resort,
    accommodation: result.fields.accommodation,
    boardBasis: result.fields.boardBasis,
    tourOperator: result.fields.tourOperator,
    outboundDepartAirport: result.fields.outboundDepartAirport,
    outboundDepartAirportName: result.fields.outboundDepartAirportName,
    outboundArriveAirport: result.fields.outboundArriveAirport,
    outboundArriveAirportName: result.fields.outboundArriveAirportName,
    inboundDepartAirport: result.fields.inboundDepartAirport,
    inboundDepartAirportName: result.fields.inboundDepartAirportName,
    inboundArriveAirport: result.fields.inboundArriveAirport,
    inboundArriveAirportName: result.fields.inboundArriveAirportName,
    roomType: result.fields.roomType,
    isLodgeQuote,
    lodgeCode: lodgeCodeVal,
    lodgeName: isLodgeQuote ? (lodgeName || undefined) : undefined,
    parkName: isLodgeQuote ? (lodgeParkName || undefined) : undefined,
    parkCode,
    ...lineItemsInput,
  };

  const idMapping = await jsonMapperApi.mapToIds(mappingInput);

  if (idMapping.warnings.length > 0) {
    toast({
      title: idMapping.warnings.some((w: string) => w.startsWith("Created"))
        ? "Entities created"
        : "Some values need attention",
      description: idMapping.warnings.join(", "),
    });
  } else {
    toast({ title: "JSON imported successfully", description: "All values mapped to database IDs" });
  }

  const idOnlyFields = new Set([
    "country", "destination", "resort", "accommodation", "accommodationId",
    "boardBasis", "boardBasisId", "tourOperator", "tourOperatorId",
    "outboundDepartAirport", "outboundDepartAirportName", "outboundDepartAirportId",
    "outboundArriveAirport", "outboundArriveAirportName", "outboundArriveAirportId",
    "inboundDepartAirport", "inboundDepartAirportName", "inboundDepartAirportId",
    "inboundArriveAirport", "inboundArriveAirportName", "inboundArriveAirportId",
    "roomType",
  ]);
  for (const [k, v] of Object.entries(result.fields)) {
    if (v !== "" && v !== null && v !== undefined && !idOnlyFields.has(k)) {
      setValue(k, v as never);
    }
  }

  // The loop above copies the raw JSON value, which may be missing OR a label
  // that isn't one of the form's dropdown options (e.g. "Transfer included") —
  // either would leave the select empty. Always set the normalized value:
  // recognized types pass through, anything else becomes an explicit "None".
  setValue("transferType", normalizeTransferType(result.fields.transferType) as never);

  if (idMapping.countryId) setValue("country", idMapping.countryId);
  if (idMapping.destinationId) setValue("destination", idMapping.destinationId);
  if (idMapping.resortId) setValue("resort", idMapping.resortId);
  if (idMapping.accommodationId) setValue("accommodationId", idMapping.accommodationId);
  if (idMapping.boardBasisId) setValue("boardBasisId", idMapping.boardBasisId);
  if (idMapping.tourOperatorId) setValue("tourOperatorId", idMapping.tourOperatorId);
  if (idMapping.outboundDepartAirportId) setValue("outboundDepartAirportId", idMapping.outboundDepartAirportId);
  if (idMapping.outboundArriveAirportId) setValue("outboundArriveAirportId", idMapping.outboundArriveAirportId);
  if (idMapping.inboundDepartAirportId) setValue("inboundDepartAirportId", idMapping.inboundDepartAirportId);
  if (idMapping.inboundArriveAirportId) setValue("inboundArriveAirportId", idMapping.inboundArriveAirportId);
  // Invalidate airports so any newly-created airport row is available in the dropdown.
  if (idMapping.outboundDepartAirportId || idMapping.outboundArriveAirportId || idMapping.inboundDepartAirportId || idMapping.inboundArriveAirportId) {
    queryClient.invalidateQueries({ queryKey: ["airports"] });
  }
  if (idMapping.roomTypeId) setValue("roomType", idMapping.roomTypeId);

  const serverDetectedLodge = (idMapping as unknown as Record<string, unknown>).isLodge === true;
  if (isLodgeQuote || serverDetectedLodge) {
    const hotTubPackage = packageTypesData?.find((p) => p.name === "Hot Tub Break");
    if (hotTubPackage) setValue("packageType", hotTubPackage.id);
    if (skipLodgeResetRef && idMapping.parkId && idMapping.lodgeId) {
      skipLodgeResetRef.current = true;
    }
    if (idMapping.parkId) setValue("parkId", idMapping.parkId);
    if (idMapping.lodgeId) setValue("lodgeId", idMapping.lodgeId);
    setValue("country", "");
    setValue("destination", "");
    setValue("resort", "");
    setValue("accommodationId", "");

    queryClient.invalidateQueries({ queryKey: lookupKeys.parks });
    if (idMapping.parkId) {
      queryClient.invalidateQueries({ queryKey: lookupKeys.lodges(idMapping.parkId as string) });
    }
  } else {
    // Not a lodge → this is a package holiday. Switch the form's type explicitly
    // so importing a package after a Hot Tub Break doesn't stay stuck on it.
    const packageHoliday = packageTypesData?.find((p) => p.name === "Package Holiday");
    if (packageHoliday) setValue("packageType", packageHoliday.id);
  }

  setValue(
    "outboundConnectingLegs",
    result.outboundConnectingLegs.map((leg) => ({
      ...leg,
      departAirportId: resolveAirportId(leg.departAirport, airportsData),
      arriveAirportId: resolveAirportId(leg.arriveAirport, airportsData),
    })) as any
  );
  setValue(
    "inboundConnectingLegs",
    result.inboundConnectingLegs.map((leg) => ({
      ...leg,
      departAirportId: resolveAirportId(leg.departAirport, airportsData),
      arriveAirportId: resolveAirportId(leg.arriveAirport, airportsData),
    })) as any
  );

  // Apply all line items from the single batched mapToIds result.
  const { counts: extraCounts, unresolvedHotels } = applyLineItems(setValue, lineItems, idMapping, queryClient);
  if (unresolvedHotels.length > 0) {
    toast({
      title: "Some extra hotels need attention",
      description: `Could not resolve: ${unresolvedHotels.join(", ")}`,
      variant: "destructive",
    });
  }
  if (extraCounts.length) {
    toast({ title: "Extras imported", description: extraCounts.join(", ") });
  }

  if (setImageUrls) {
    setImageUrls(() => result.images ?? []);
  }
}

function handleFallbackJson(data: Record<string, any>, deps: JsonImportDeps): void {
  const { form, toast, setImageUrls, fallbackFieldMapper } = deps;
  const { setValue } = form;

  let fieldsSet = 0;
  const setIfPresent = (key: string, val: unknown) => {
    if (val !== undefined && val !== null && val !== "") {
      setValue(key, val as any);
      fieldsSet++;
    }
  };

  setIfPresent("packageType", data.packageType || data.package_type);
  setIfPresent("quoteTitle", data.quoteTitle || data.quote_title || data.title);
  setIfPresent("travelDate", toIsoDate(data.travelDate || data.travel_date || data.departureDate));
  setIfPresent("passengersAdults", data.passengers?.adults || data.adults || data.passengersAdults);
  setIfPresent("passengersChildren", data.passengers?.children || data.children || data.passengersChildren);
  setIfPresent("passengersInfants", data.passengers?.infants || data.infants || data.passengersInfants);
  setIfPresent("checkInDate", toIsoDate(data.checkInDate || data.check_in_date || data.checkin));
  setIfPresent("checkInTime", data.checkInTime || data.check_in_time);
  setIfPresent("nights", data.nights || data.duration);
  // Normalized so a JSON without a transfer type — or with one that isn't a
  // dropdown option — resets the field to "None" instead of keeping the
  // pre-import value or leaving the select empty.
  setIfPresent("transferType", normalizeTransferType(data.transferType || data.transfer_type || data.transfers));
  setIfPresent("preBookedSeats", data.preBookedSeats || data.pre_booked_seats || data.seats);
  setIfPresent("flightMeals", data.flightMeals || data.flight_meals || data.meals);
  setIfPresent("outboundDepartDate", toIsoDate(data.flights?.outbound?.departDate || data.outbound?.date));
  setIfPresent("outboundDepartTime", data.flights?.outbound?.departTime || data.outbound?.time);
  setIfPresent("outboundArriveDate", toIsoDate(data.flights?.outbound?.arriveDate));
  setIfPresent("outboundArriveTime", data.flights?.outbound?.arriveTime);
  setIfPresent("inboundDepartDate", toIsoDate(data.flights?.inbound?.departDate || data.inbound?.date));
  setIfPresent("inboundDepartTime", data.flights?.inbound?.departTime || data.inbound?.time);
  setIfPresent("inboundArriveDate", toIsoDate(data.flights?.inbound?.arriveDate));
  setIfPresent("inboundArriveTime", data.flights?.inbound?.arriveTime);
  // The form's `price` field holds the GROSS sales price, whereas `commissions.price`
  // is the total the customer pays (sales − discount + service charge). Read the discount
  // and service charge first so that when only the total is available we can reconstruct
  // the gross — otherwise re-importing an exported quote would mis-apply the adjustments.
  const importedDiscount = data.commissions?.discount ?? data.commissions?.discounts ?? data.discount ?? data.discounts;
  const importedServiceCharge = data.commissions?.serviceCharge ?? data.serviceCharge ?? data.service_charge;
  const discountNum = Number(importedDiscount) || 0;
  const serviceChargeNum = Number(importedServiceCharge) || 0;

  const grossPrice =
    data.sales_price ?? data.salesPrice ?? data.price ?? data.total ??
    (data.commissions?.price != null
      ? Number(data.commissions.price) + discountNum - serviceChargeNum
      : undefined);

  setIfPresent("price", grossPrice);
  setIfPresent("commission", data.commissions?.commission || data.commission);
  setIfPresent("discount", importedDiscount);
  setIfPresent("serviceCharge", importedServiceCharge);
  setIfPresent("pricePerPerson", data.commissions?.pricePerPerson || data.pricePerPerson || data.price_per_person || data.ppp);

  if (fallbackFieldMapper) {
    fallbackFieldMapper(data, setIfPresent, toIsoDate);
  }

  if (setImageUrls) {
    const extractedImages: string[] = [];
    const imageFields = [
      data.images, data.image, data.photos, data.photo,
      data.imageUrl, data.image_url, data.imageUrls, data.image_urls,
      data.thumbnails, data.thumbnail, data.gallery,
      data.accommodation?.image, data.accommodation?.imageUrl,
      data.hotel?.image, data.hotel?.imageUrl,
    ];
    for (const field of imageFields) {
      if (typeof field === "string" && field.startsWith("http")) {
        extractedImages.push(field);
      } else if (Array.isArray(field)) {
        for (const item of field) {
          if (typeof item === "string" && item.startsWith("http")) {
            extractedImages.push(item);
          } else if (item?.url && typeof item.url === "string") {
            extractedImages.push(item.url);
          }
        }
      }
    }
    setImageUrls(() => extractedImages);
  }

  if (fieldsSet === 0) {
    toast({
      title: "No fields recognised",
      description: "The JSON file was valid but contained no fields that could be mapped to the form.",
      variant: "destructive",
    });
  } else {
    toast({ title: "JSON imported", description: `${fieldsSet} field${fieldsSet === 1 ? "" : "s"} populated from JSON.` });
  }
}

async function handleCruiseJson(data: Record<string, any>, deps: JsonImportDeps): Promise<void> {
  const { form, packageTypesData, queryClient, toast, setImageUrls } = deps;
  const { setValue } = form;
  const { jsonMapperApi } = await import("@/features/json-mapper/api/json-mapper.api");

  // Cruise details may be nested under `cruise` or sit at the top level.
  const cruise = data.cruise && typeof data.cruise === "object" ? data.cruise : data;

  let fieldsSet = 0;
  const setIfPresent = (key: string, val: unknown) => {
    if (val !== undefined && val !== null && val !== "") {
      setValue(key, val as any);
      fieldsSet++;
    }
  };

  // Force the package type to Cruise so the cruise section renders.
  const cruisePackage = packageTypesData?.find((p) => p.name === "Cruise Package");
  if (cruisePackage) setValue("packageType", cruisePackage.id);

  // Common quote/booking-level fields.
  // No transfer type in the JSON — or one that isn't a dropdown option — means
  // an explicit "None", not the pre-import value or an empty select.
  setIfPresent("transferType", normalizeTransferType(data.transferType || data.transfer_type));
  setIfPresent("quoteTitle", data.quoteTitle || data.quote_title || data.title);
  setIfPresent("travelDate", toIsoDate(data.travelDate || data.travel_date || data.departureDate));
  setIfPresent("passengersAdults", data.passengers?.adults ?? data.adults);
  setIfPresent("passengersChildren", data.passengers?.children ?? data.children);
  setIfPresent("passengersInfants", data.passengers?.infants ?? data.infants);
  setIfPresent("nights", data.nights || data.duration);
  setIfPresent("price", data.sales_price ?? data.price ?? data.commissions?.price);
  setIfPresent("commission", data.commissions?.commission ?? data.commission);
  setIfPresent("discount", data.commissions?.discount ?? data.discount);
  setIfPresent("serviceCharge", data.commissions?.serviceCharge ?? data.service_charge);

  // Cruise fields — stored by NAME, matching the cascading dropdowns.
  // Accept both snake_case and the preview page's vocabulary (ship / cruise company / departure date+port).
  const cruiseLine = cruise.cruise_line || cruise.cruiseLine || cruise.cruise_company || cruise.cruiseCompany;
  const shipName = cruise.ship_name || cruise.shipName || cruise.ship;
  const cruiseDate = toIsoDate(cruise.cruise_date || cruise.cruiseDate || cruise.departure_date || cruise.departureDate || cruise.date);
  const cruiseTitle = cruise.cruise_title || cruise.cruiseTitle || cruise.title;
  const embarkation = cruise.embarkation || cruise.departure_port || cruise.departurePort || cruise.leaving_from || cruise.leavingFrom;

  const cruiseOnly = cruise.cruise_only ?? cruise.cruiseOnly ?? false;
  setIfPresent("cruiseOnly", cruiseOnly);
  setIfPresent("cruiseTitle", cruiseTitle);
  setIfPresent("cruiseLine", cruiseLine);
  setIfPresent("shipName", shipName);
  setIfPresent("cruiseDate", cruiseDate);
  setIfPresent("cabinType", cruise.cabin_type || cruise.cabinType);
  setIfPresent("cabinNumber", cruise.cabin_number || cruise.cabinNumber || cruise.cabin_location || cruise.cabinLocation);
  setIfPresent("embarkation", embarkation);
  setIfPresent("debarkation", cruise.debarkation || cruise.arrival_port || cruise.arrivalPort || cruise.disembarkation);
  setIfPresent("cruiseExtras", cruise.cruise_extras || cruise.cruiseExtras);

  // Map any form-specific fallback fields (e.g. quoteLink) that aren't part of the
  // cruise-specific mapping. handleFallbackJson runs this for non-cruise imports, so
  // the cruise path must run it too or fields like the Quote Link never populate.
  if (deps.fallbackFieldMapper) {
    deps.fallbackFieldMapper(data, setIfPresent, toIsoDate);
  }

  // Fly-cruise: map flight dates/times when the JSON carries a flights block and it's not cruise-only.
  // Airport NAMES are resolved to DB ids via the same mapToIds call below.
  const flights = !cruiseOnly && data.flights && typeof data.flights === "object" ? data.flights : null;
  const ob = flights?.outbound ?? {};
  const ib = flights?.inbound ?? {};
  if (flights) {
    setIfPresent("outboundDepartDate", toIsoDate(ob.departDate || ob.depart_date || ob.date));
    setIfPresent("outboundDepartTime", ob.departTime || ob.depart_time);
    setIfPresent("outboundArriveDate", toIsoDate(ob.arriveDate || ob.arrive_date));
    setIfPresent("outboundArriveTime", ob.arriveTime || ob.arrive_time);
    setIfPresent("outboundFlightNumber", ob.flightNumber || ob.flight_number);
    setIfPresent("inboundDepartDate", toIsoDate(ib.departDate || ib.depart_date || ib.date));
    setIfPresent("inboundDepartTime", ib.departTime || ib.depart_time);
    setIfPresent("inboundArriveDate", toIsoDate(ib.arriveDate || ib.arrive_date));
    setIfPresent("inboundArriveTime", ib.arriveTime || ib.arrive_time);
    setIfPresent("inboundFlightNumber", ib.flightNumber || ib.flight_number);
  }

  // Day-by-day itinerary → hidden form field, persisted with the quote/booking.
  // Accept `itinerary`/`days`, day as number or "Day 3" text, and description or port.
  const rawItinerary = Array.isArray(cruise.itinerary) ? cruise.itinerary : Array.isArray(cruise.days) ? cruise.days : [];
  const itinerary = rawItinerary.map((d: any, idx: number) => {
    const rawDay = d?.day ?? d?.day_number;
    const parsedDay = typeof rawDay === "number" ? rawDay : parseInt(String(rawDay ?? "").replace(/[^\d]/g, ""), 10);
    return {
      day: Number.isFinite(parsedDay) && parsedDay > 0 ? parsedDay : idx + 1,
      description: String(d?.description ?? d?.port ?? ""),
      subDescription: String(d?.sub_description ?? d?.subDescription ?? d?.subtitle ?? ""),
    };
  });
  setValue("cruiseItinerary", itinerary as any);

  // A cruise can also carry line items (pre/post-cruise hotels, transfers, parking,
  // etc.). They're resolved in the SAME catalog call below. There's no quote-level
  // location for a cruise, so each extra hotel must carry its own country/dest/resort.
  const { raw: lineItems, input: lineItemsInput } = collectLineItems(data, {});

  // Find-or-create the catalog rows server-side, then refresh the lookups so the
  // newly-created line/ship/voyage become selectable and the names resolve.
  try {
    const result = await jsonMapperApi.mapToIds({
      cruiseLine,
      shipName,
      cruiseDate,
      embarkation,
      cruiseTitle,
      cruiseItinerary: itinerary,
      // Fly-cruise airport names → resolved to DB ids below.
      outboundDepartAirport: flights ? (ob.departAirport || ob.depart_airport) : undefined,
      outboundArriveAirport: flights ? (ob.arriveAirport || ob.arrive_airport) : undefined,
      inboundDepartAirport: flights ? (ib.departAirport || ib.depart_airport) : undefined,
      inboundArriveAirport: flights ? (ib.arriveAirport || ib.arrive_airport) : undefined,
      ...lineItemsInput,
    });

    if (flights) {
      if (result.outboundDepartAirportId) setValue("outboundDepartAirportId", result.outboundDepartAirportId as never);
      if (result.outboundArriveAirportId) setValue("outboundArriveAirportId", result.outboundArriveAirportId as never);
      if (result.inboundDepartAirportId) setValue("inboundDepartAirportId", result.inboundDepartAirportId as never);
      if (result.inboundArriveAirportId) setValue("inboundArriveAirportId", result.inboundArriveAirportId as never);
      // Invalidate airports so any newly-created airport row is available in the dropdown.
      if (result.outboundDepartAirportId || result.outboundArriveAirportId || result.inboundDepartAirportId || result.inboundArriveAirportId) {
        queryClient.invalidateQueries({ queryKey: ["airports"] });
      }
    }

    // Apply extra hotels / transfers / car hire / attractions / lounge / parking.
    const { counts: extraCounts, unresolvedHotels } = applyLineItems(setValue, lineItems, result, queryClient);
    if (unresolvedHotels.length > 0) {
      toast({
        title: "Some extra hotels need attention",
        description: `Could not resolve: ${unresolvedHotels.join(", ")}`,
        variant: "destructive",
      });
    }
    if (extraCounts.length) {
      toast({ title: "Extras imported", description: extraCounts.join(", ") });
    }

    // The cruise section's Ship dropdown is keyed off the cruise-line id (derived
    // from the line NAME) and the Date dropdown off the ship id. Those queries are
    // disabled until their parent id resolves, and the dropdowns only render a value
    // that's present in their loaded options — so a plain invalidate races and the
    // ship/date show blank. Seed the caches with the rows we just created/resolved,
    // using the exact query keys the form reads, so the cascade resolves immediately.
    const upsertById = <T extends { id: string }>(list: T[] | undefined, row: T): T[] => {
      const arr = Array.isArray(list) ? list : [];
      return arr.some((r) => r.id === row.id) ? arr : [...arr, row];
    };

    if (result.cruiseLineId && cruiseLine) {
      queryClient.setQueryData(["lookup", "cruise-lines"], (old: any) => upsertById(old, { id: result.cruiseLineId, name: cruiseLine }));
    }
    if (result.cruiseLineId && result.shipId && shipName) {
      queryClient.setQueryData(["lookup", "ships", result.cruiseLineId], (old: any) =>
        upsertById(old, { id: result.shipId, name: shipName, cruise_line_id: result.cruiseLineId }),
      );
    }
    if (result.shipId && result.cruiseItineraryId && cruiseDate) {
      queryClient.setQueryData(["lookup", "cruise-itineraries", result.shipId], (old: any) =>
        upsertById(old, { id: result.cruiseItineraryId, ship_id: result.shipId, itenary: cruiseTitle ?? null, departure_port: embarkation ?? "", date: cruiseDate }),
      );
    }

    // Refresh in the background so the full authoritative lists load too (the seeded
    // rows stay visible while these refetch).
    queryClient.invalidateQueries({ queryKey: ["lookup", "cruise-lines"] });
    queryClient.invalidateQueries({ queryKey: ["lookup", "ships"] });
    queryClient.invalidateQueries({ queryKey: ["lookup", "cruise-itineraries"] });

    if (result.warnings?.length) {
      toast({
        title: result.warnings.some((w) => w.startsWith("Created")) ? "Cruise catalog updated" : "Cruise imported",
        description: result.warnings.join(", "),
      });
    } else {
      toast({ title: "Cruise imported", description: `${fieldsSet} field${fieldsSet === 1 ? "" : "s"} populated from JSON.` });
    }
  } catch (error) {
    toast({
      title: "Cruise catalog mapping failed",
      description: error instanceof Error ? error.message : "Could not create cruise records.",
      variant: "destructive",
    });
  }

  if (setImageUrls) {
    const imgs: string[] = [];
    for (const field of [data.images, data.image, cruise.images, cruise.image]) {
      if (typeof field === "string" && field.startsWith("http")) imgs.push(field);
      else if (Array.isArray(field)) {
        for (const item of field) {
          if (typeof item === "string" && item.startsWith("http")) imgs.push(item);
          else if (item?.url && typeof item.url === "string") imgs.push(item.url);
        }
      }
    }
    setImageUrls(() => imgs);
  }
}

// Data-level entry point: dispatches an already-parsed JSON object through the
// cruise / scraper / fallback import paths. Used by the file upload below and
// by URL-based imports (e.g. the easyJet trade-portal scraper), which receive
// the object from the API rather than a file.
export async function handleJsonData(record: Record<string, any>, deps: JsonImportDeps): Promise<void> {
  const { toast } = deps;

  if (isCruiseFormat(record)) {
    try {
      await handleCruiseJson(record, deps);
    } catch (error) {
      toast({
        title: "Error processing cruise JSON",
        description: error instanceof Error ? error.message : "Failed to map cruise values.",
        variant: "destructive",
      });
    }
    return;
  }

  if (isScraperFormat(record)) {
    try {
      await handleScraperJson(record, deps);
    } catch (error) {
      toast({
        title: "Error processing JSON",
        description: error instanceof Error ? error.message : "Failed to map values.",
        variant: "destructive",
      });
    }
    return;
  }

  handleFallbackJson(record, deps);
}

// Returns a Promise that resolves once the import finishes (or fails), so the
// caller can show a loading state for the whole file-import flow.
export function handleJsonUpload(file: File, deps: JsonImportDeps): Promise<void> {
  const { toast } = deps;

  if (file.size === 0) {
    toast({ title: "Empty file", description: "The selected file is empty.", variant: "destructive" });
    return Promise.resolve();
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_SIZE) {
    toast({ title: "File too large", description: "JSON file must be under 5 MB.", variant: "destructive" });
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const reader = new FileReader();

    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result;

        if (typeof content !== "string" || content.trim() === "") {
          toast({ title: "Empty file", description: "The file appears to be empty.", variant: "destructive" });
          return;
        }

        let data: unknown;
        try {
          data = JSON.parse(content);
        } catch (err) {
          toast({
            title: "Invalid JSON",
            description: err instanceof Error ? err.message : "Could not parse the file as JSON.",
            variant: "destructive",
          });
          return;
        }

        if (data === null || typeof data !== "object" || Array.isArray(data)) {
          toast({
            title: "Invalid JSON format",
            description: "JSON must be an object (e.g. { ... }), not an array or plain value.",
            variant: "destructive",
          });
          return;
        }

        await handleJsonData(data as Record<string, any>, deps);
      } finally {
        resolve();
      }
    };

    reader.onerror = () => {
      toast({ title: "Error reading file", description: "Could not read the file.", variant: "destructive" });
      resolve();
    };

    reader.onabort = () => {
      toast({ title: "File read cancelled", description: "The file read was aborted.", variant: "destructive" });
      resolve();
    };

    reader.readAsText(file);
  });
}
