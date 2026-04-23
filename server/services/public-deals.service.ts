import { publicDealsRepository, DealFilters } from "../repositories/public-deals.repository";

function resolveDestination(r: any): { destination: string | null; country: string | null } {
  if (r.quoteType === "hot_tub_break") {
    return {
      destination: r.parkCity || r.parkLocation || r.cottageLocation || null,
      country: "United Kingdom",
    };
  }
  if (r.quoteType === "cruise") {
    return { destination: r.cruiseName || null, country: null };
  }
  return { destination: r.destinationName || null, country: r.countryName || null };
}

type FlightLeg = {
  legOrder: number;
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureDateTime: Date | null;
  arrivalDateTime: Date | null;
};

function formatDeal(
  r: any,
  imageMap: Record<string, string[]>,
  primaryMap: Record<string, string>,
  flightLegsMap: Record<string, FlightLeg[]>,
  includesMap: Record<string, string[]>,
  guruMap: Record<string, unknown>,
  tagsMap: Record<string, string[]>,
  detail = false,
) {
  const { destination: dest, country: ctry } = resolveDestination(r);
  const images = imageMap[r.id] || [];
  const guruData = dest ? ((guruMap[dest] ?? guruMap[dest.toLowerCase()]) as any) ?? null : null;

  const returnDate =
    r.travelDate && r.numNights
      ? (() => {
          const d = new Date(r.travelDate);
          d.setDate(d.getDate() + r.numNights);
          return d.toISOString().split("T")[0];
        })()
      : null;

  const legs = r.quoteType !== "hot_tub_break" ? (flightLegsMap[r.id] || []) : [];
  const firstLeg = legs[0] ?? null;

  return {
    id: r.id,
    title: r.title || `${dest || "Holiday"} Getaway`,
    destination: dest,
    country: ctry,
    category: r.category || null,
    description: guruData?.travelInfo?.summary || null,
    shortDescription: guruData?.tagline || null,
    price: parseFloat(r.salesPrice || "0"),
    pricePerPerson: r.pricePerPerson ? parseFloat(r.pricePerPerson) : null,
    originalPrice: r.pricePerPerson ? parseFloat(r.pricePerPerson) : null,
    imageUrl: primaryMap[r.id] || images[0] || null,
    imageUrls: images,
    nights: r.numNights ?? null,
    departureDate: r.travelDate || null,
    returnDate,
    departureAirport: firstLeg?.departureAirport ?? null,
    departureDateTime: firstLeg?.departureDateTime ? new Date(firstLeg.departureDateTime).toISOString() : null,
    arrivalDateTime: firstLeg?.arrivalDateTime ? new Date(firstLeg.arrivalDateTime).toISOString() : null,
    flightLegs: legs.map((leg) => ({
      legOrder: leg.legOrder,
      departureAirport: leg.departureAirport,
      arrivalAirport: leg.arrivalAirport,
      departureDateTime: leg.departureDateTime ? new Date(leg.departureDateTime).toISOString() : null,
      arrivalDateTime: leg.arrivalDateTime ? new Date(leg.arrivalDateTime).toISOString() : null,
    })),
    includes: includesMap[r.id] || [],
    highlights: guruData?.mustDo
      ? (guruData.mustDo as any[]).slice(0, 5).map((m: any) => m.name)
      : [],
    featured: r.isFeatured ?? false,
    active: r.isActive ?? true,
    createdAt: r.dateCreated ? new Date(r.dateCreated).toISOString() : null,
    destinationGuru: guruData !== undefined ? guruData : null,
    ...(detail && {
      tags: tagsMap[r.id] || [],
    }),
  };
}

async function enrichRows(rows: any[], detail = false) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const destNames = Array.from(new Set(
    rows
      .filter((r) => r.quoteType !== "hot_tub_break" && r.quoteType !== "cruise" && r.destinationName)
      .map((r) => r.destinationName as string),
  ));

  const [{ imageMap, primaryMap }, flightMap, includesMap, guruRows, tagsMap] = await Promise.all([
    publicDealsRepository.fetchImagesByQuoteIds(ids),
    publicDealsRepository.fetchFlightsByQuoteIds(ids),
    publicDealsRepository.fetchIncludesByQuoteIds(ids),
    publicDealsRepository.fetchGuruByDestinations(destNames),
    detail ? publicDealsRepository.fetchTagsByQuoteIds(ids) : Promise.resolve({} as Record<string, string[]>),
  ]);

  const guruMap: Record<string, unknown> = {};
  for (const g of guruRows) {
    guruMap[g.queryName] = g.data;
  }

  console.log("[enrichRows] destNames:", destNames);
  console.log("[enrichRows] guruRows:", guruRows.map(g => ({ queryName: g.queryName, destination: g.destination })));
  console.log("[enrichRows] guruMap keys:", Object.keys(guruMap));

  return rows.map((r) => formatDeal(r, imageMap, primaryMap, flightMap, includesMap, guruMap, tagsMap, detail));
}

export const publicDealsService = {
  async getDeals(filters: DealFilters & { page?: number }) {
    const { page = 0, limit = 20, ...rest } = filters;
    const offset = page * limit;

    const rows = await publicDealsRepository.findDeals({ ...rest, limit: limit + 1, offset });
    const hasMore = rows.length > limit;
    const deals = await enrichRows(rows.slice(0, limit));

    return { deals, page, hasMore, filters: { countries: rest.countries, tags: rest.tags } };
  },

  async getLatestDeals(limit: number) {
    const rows = await publicDealsRepository.findDeals({ sortBy: "newest", limit });
    return enrichRows(rows);
  },

  async getFeaturedDeals() {
    const rows = await publicDealsRepository.findDeals({ featuredOnly: true, limit: 50 });
    return enrichRows(rows);
  },

  async getDealById(id: string) {
    const row = await publicDealsRepository.findDealById(id);
    if (!row) return null;
    const [deal] = await enrichRows([row], true);
    return deal;
  },

  async getAllDestinations() {
    return publicDealsRepository.findAllDestinations();
  },

  async getDestinationByName(name: string) {
    return publicDealsRepository.findDestinationByName(name);
  },

  async getDealFilters() {
    return publicDealsRepository.findDealFilters();
  },

  async getStats() {
    return publicDealsRepository.getStats();
  },

  async getCategories() {
    const { catRows, repRows } = await publicDealsRepository.findCategories();
    if (catRows.length === 0) return [];

    const repIds = repRows.map((r) => r.id);
    const { imageMap, primaryMap } = await publicDealsRepository.fetchImagesByQuoteIds(repIds);
    const imageByCategory: Record<string, string | null> = Object.fromEntries(
      repRows.map((r) => [r.category, primaryMap[r.id] || (imageMap[r.id] || [])[0] || null]),
    );

    return catRows.map((cat) => ({
      category: cat.category,
      count: cat.count,
      minPrice: parseFloat(cat.minPrice || "0"),
      imageUrl: imageByCategory[cat.category!] || null,
    }));
  },
};
