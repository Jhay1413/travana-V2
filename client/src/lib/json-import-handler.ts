import type { UseFormReturn } from "react-hook-form";
import type { QueryClient } from "@tanstack/react-query";
import type { JsonMappingResult } from "@/api/endpoints/json-mapper.api";

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
  return (
    (data.cruise_line !== undefined || data.cruiseLine !== undefined) &&
    (data.ship_name !== undefined || data.shipName !== undefined)
  );
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

async function handleScraperJson(data: Record<string, any>, deps: JsonImportDeps): Promise<void> {
  const { form, airportsData, packageTypesData, queryClient, lookupKeys, toast, setImageUrls, skipLodgeResetRef } = deps;
  const { setValue } = form;

  const { mapScraperJsonToFormFields } = await import("@/lib/scraper-json-parser");
  const { jsonMapperApi } = await import("@/api/endpoints/json-mapper.api");

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
  const currentPackageType = form.getValues("packageType");
  const currentPackageName =
    packageTypesData?.find((p) => p.id === currentPackageType)?.name || currentPackageType;
  const isCurrentFormLodge = currentPackageName === "Hot Tub Break";
  const tourOp = (data.tour_operator || result.fields.tourOperator || "").toLowerCase().trim();
  const lodgeTourOperators = [
    "hoseasons", "haven", "parkdean", "park dean", "butlins",
    "center parcs", "centre parcs", "away resorts", "park holidays",
  ];
  const isLodgeTourOperator = lodgeTourOperators.some((op) => tourOp.includes(op));
  const isLodgeQuote = hasLodgeFieldsInJson || isCurrentFormLodge || isLodgeTourOperator;

  const lodgeParkName = data.lodge_park_name || data.resort || result.fields.resort || "";
  const lodgeCodeVal = data.lodge_code || data.cottage_id || null;
  const lodgeName = data.accommodation || result.fields.accommodation || "";
  const parkCode = data.lodge_id || null;

  const mappingInput: Record<string, unknown> = {
    country: result.fields.country,
    destination: result.fields.destination,
    resort: result.fields.resort,
    accommodation: result.fields.accommodation,
    boardBasis: result.fields.boardBasis,
    tourOperator: result.fields.tourOperator,
    outboundDepartAirport: result.fields.outboundDepartAirport,
    outboundArriveAirport: result.fields.outboundArriveAirport,
    inboundDepartAirport: result.fields.inboundDepartAirport,
    inboundArriveAirport: result.fields.inboundArriveAirport,
    roomType: result.fields.roomType,
    isLodgeQuote,
    lodgeCode: lodgeCodeVal,
    lodgeName: isLodgeQuote ? (lodgeName || undefined) : undefined,
    parkName: isLodgeQuote ? (lodgeParkName || undefined) : undefined,
    parkCode,
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
    "outboundDepartAirport", "outboundDepartAirportId",
    "outboundArriveAirport", "outboundArriveAirportId",
    "inboundDepartAirport", "inboundDepartAirportId",
    "inboundArriveAirport", "inboundArriveAirportId",
    "roomType",
  ]);
  for (const [k, v] of Object.entries(result.fields)) {
    if (v !== "" && v !== null && v !== undefined && !idOnlyFields.has(k)) {
      setValue(k, v as never);
    }
  }

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
  setIfPresent("transferType", data.transferType || data.transfer_type || data.transfers);
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
  const { jsonMapperApi } = await import("@/api/endpoints/json-mapper.api");

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
  const cruiseLine = cruise.cruise_line || cruise.cruiseLine;
  const shipName = cruise.ship_name || cruise.shipName;
  const cruiseDate = toIsoDate(cruise.cruise_date || cruise.cruiseDate);
  const cruiseTitle = cruise.cruise_title || cruise.cruiseTitle;
  const embarkation = cruise.embarkation;

  setIfPresent("cruiseOnly", cruise.cruise_only ?? cruise.cruiseOnly ?? false);
  setIfPresent("cruiseTitle", cruiseTitle);
  setIfPresent("cruiseLine", cruiseLine);
  setIfPresent("shipName", shipName);
  setIfPresent("cruiseDate", cruiseDate);
  setIfPresent("cabinType", cruise.cabin_type || cruise.cabinType);
  setIfPresent("embarkation", embarkation);
  setIfPresent("debarkation", cruise.debarkation);
  setIfPresent("cruiseExtras", cruise.cruise_extras || cruise.cruiseExtras);

  // Day-by-day itinerary → hidden form field, persisted with the quote/booking.
  const itinerary = Array.isArray(cruise.itinerary)
    ? cruise.itinerary
        .map((d: any) => ({ day: Number(d?.day ?? d?.day_number) || 0, description: String(d?.description ?? "") }))
        .filter((d: { day: number }) => d.day > 0)
    : [];
  setValue("cruiseItinerary", itinerary as any);

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
    });

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

export function handleJsonUpload(file: File, deps: JsonImportDeps): void {
  const { toast } = deps;

  if (file.size === 0) {
    toast({ title: "Empty file", description: "The selected file is empty.", variant: "destructive" });
    return;
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_SIZE) {
    toast({ title: "File too large", description: "JSON file must be under 5 MB.", variant: "destructive" });
    return;
  }

  const reader = new FileReader();

  reader.onload = async (ev) => {
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

    const record = data as Record<string, any>;

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
  };

  reader.onerror = () => {
    toast({ title: "Error reading file", description: "Could not read the file.", variant: "destructive" });
  };

  reader.onabort = () => {
    toast({ title: "File read cancelled", description: "The file read was aborted.", variant: "destructive" });
  };

  reader.readAsText(file);
}
