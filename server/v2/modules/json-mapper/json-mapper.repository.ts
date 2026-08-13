import { db } from '../../config/database';
import { country, destination, resorts, accomodation_list, board_basis, tour_operator, airport, room_type, lodges, park } from '@shared/schema';
import { ilike, and, eq, isNull, type SQL } from 'drizzle-orm';

// ILIKE treats %, _ and \ as pattern syntax; escape them so a name like
// "100% Beach Resort" is matched literally.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Exact (case-insensitive) match first, contains-match only as a fallback.
// A plain `%name%` lookup let any catalog row CONTAINING the search string win
// — "Cala Nova" resolved to "Fiesta Cala Nova Hotel", a different hotel.
// ILIKE without wildcards is case-insensitive equality.
async function exactThenContains<T>(run: (pattern: string) => Promise<T[]>, name: string): Promise<T | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [exact] = await run(escapeLike(trimmed));
  if (exact) return exact;
  const [contains] = await run(`%${escapeLike(trimmed)}%`);
  return contains ?? null;
}

export const jsonMapperRepository = {
  async findCountryByName(name: string) {
    if (!name) return null;
    return exactThenContains((p) => db.select().from(country).where(ilike(country.country_name, p)).limit(1), name);
  },

  async findDestinationByName(name: string, countryId?: string) {
    if (!name) return null;
    return exactThenContains((p) => {
      const conditions: SQL[] = [ilike(destination.name, p)];
      if (countryId) conditions.push(eq(destination.country_id, countryId));
      return db.select().from(destination).where(and(...conditions)).limit(1);
    }, name);
  },

  async findResortByName(name: string, destinationId?: string) {
    if (!name) return null;
    return exactThenContains((p) => {
      const conditions: SQL[] = [ilike(resorts.name, p)];
      if (destinationId) conditions.push(eq(resorts.destination_id, destinationId));
      return db.select().from(resorts).where(and(...conditions)).limit(1);
    }, name);
  },

  async findAccommodationByName(name: string, resortId?: string) {
    if (!name) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const exactConditions: SQL[] = [ilike(accomodation_list.name, escapeLike(trimmed))];
    if (resortId) exactConditions.push(eq(accomodation_list.resorts_id, resortId));
    const [exact] = await db.select().from(accomodation_list).where(and(...exactConditions)).limit(1);
    if (exact) return exact;
    // Contains-fallback ONLY inside a known resort: "Cala Nova" may reasonably
    // find "Cala Nova Apartments" in the same resort, but a global contains
    // match can adopt a look-alike hotel anywhere in the world — and the
    // import then inherits that hotel's entire resort/destination/country
    // chain (see getHierarchyFromAccommodation).
    if (!resortId) return null;
    const [row] = await db
      .select()
      .from(accomodation_list)
      .where(and(ilike(accomodation_list.name, `%${escapeLike(trimmed)}%`), eq(accomodation_list.resorts_id, resortId)))
      .limit(1);
    return row || null;
  },

  async getHierarchyFromAccommodation(accommodationId: string) {
    const [row] = await db
      .select({ accommodation: accomodation_list, resort: resorts, destination, country })
      .from(accomodation_list)
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(eq(accomodation_list.id, accommodationId))
      .limit(1);
    return row || null;
  },

  async findBoardBasisByType(typeName: string) {
    if (!typeName) return null;
    return exactThenContains((p) => db.select().from(board_basis).where(ilike(board_basis.type, p)).limit(1), typeName);
  },

  // Tour operators are the only lookup here that is ORG-SCOPED (every other
  // table — board basis, room type, airport, country/destination/resort — is
  // global). The quote form's dropdown lists ONLY rows whose org_id is the
  // caller's, so a match from another org, or a global org_id IS NULL seed,
  // resolves to an id the form cannot render: the field is set but shows blank.
  // That is exactly what happened — an import resolved "Jet2holidays" to a row
  // the agency didn't own, so the operator box came back empty.
  //
  // Hence: search WITHIN the org only. `findGlobalTourOperatorByName` handles
  // the seed rows separately, because those must be copied into the org rather
  // than referenced.
  async findTourOperatorByName(name: string, orgId?: string | null) {
    if (!name) return null;
    return exactThenContains(
      (p) =>
        db
          .select()
          .from(tour_operator)
          .where(orgId ? and(ilike(tour_operator.name, p), eq(tour_operator.org_id, orgId))! : ilike(tour_operator.name, p))
          .limit(1),
      name,
    );
  },

  // A platform seed (org_id IS NULL). Matched so its commission percentage can
  // be carried into the org's own copy — creating a bare row instead would
  // silently lose the commission the quote form calculates from.
  async findGlobalTourOperatorByName(name: string) {
    if (!name) return null;
    return exactThenContains(
      (p) => db.select().from(tour_operator).where(and(ilike(tour_operator.name, p), isNull(tour_operator.org_id))!).limit(1),
      name,
    );
  },

  async findAirportByCodeOrName(codeOrName: string) {
    if (!codeOrName) return null;
    const normalized = codeOrName.toUpperCase().trim();
    const [codeRow] = await db.select().from(airport).where(eq(airport.airport_code, normalized)).limit(1);
    if (codeRow) return codeRow;
    return exactThenContains((p) => db.select().from(airport).where(ilike(airport.airport_name, p)).limit(1), codeOrName);
  },

  async findRoomTypeByName(name: string) {
    if (!name) return null;
    return exactThenContains((p) => db.select().from(room_type).where(ilike(room_type.name, p)).limit(1), name);
  },

  async findLodgeByCode(code: string) {
    if (!code) return null;
    const [row] = await db.select().from(lodges).where(ilike(lodges.lodge_code, escapeLike(code.trim()))).limit(1);
    return row || null;
  },

  async findLodgeByName(name: string) {
    if (!name) return null;
    return exactThenContains((p) => db.select().from(lodges).where(ilike(lodges.lodge_name, p)).limit(1), name);
  },

  async findParkByName(name: string) {
    if (!name) return null;
    return exactThenContains((p) => db.select().from(park).where(ilike(park.name, p)).limit(1), name);
  },

  async findParkByCode(code: string) {
    if (!code) return null;
    const [row] = await db.select().from(park).where(ilike(park.code, code.trim())).limit(1);
    return row || null;
  },

  async createCountry(name: string) {
    const [row] = await db.insert(country).values({ country_name: name }).returning();
    return row;
  },

  async createDestination(name: string, countryId: string) {
    const [row] = await db.insert(destination).values({ name, country_id: countryId }).returning();
    return row;
  },

  async createResort(name: string, destinationId: string) {
    const [row] = await db.insert(resorts).values({ name, destination_id: destinationId }).returning();
    return row;
  },

  async createAccommodation(name: string, resortId: string) {
    const [row] = await db.insert(accomodation_list).values({ name, resorts_id: resortId }).returning();
    return row;
  },

  async createBoardBasis(typeName: string) {
    const [row] = await db.insert(board_basis).values({ type: typeName }).returning();
    return row;
  },

  // Stamped with the caller's org, so the row the mapper hands back is one the
  // org-scoped dropdown will actually list. Without org_id these landed as
  // orphans owned by nobody and invisible everywhere.
  async createTourOperator(name: string, orgId?: string | null, commissionPercentage?: string | null) {
    const [row] = await db
      .insert(tour_operator)
      .values({ name, org_id: orgId ?? null, ...(commissionPercentage != null ? { commission_percentage: commissionPercentage } : {}) })
      .returning();
    return row;
  },

  async createRoomType(name: string) {
    const [row] = await db.insert(room_type).values({ name }).returning();
    return row;
  },

  async createAirport(code: string, name: string, countryId?: string) {
    const [row] = await db.insert(airport).values({ airport_code: code.toUpperCase().trim(), airport_name: name.trim(), ...(countryId ? { country_id: countryId } : {}) }).returning();
    return row;
  },

  async createPark(name: string, code?: string) {
    const [row] = await db.insert(park).values({ name, code: code || null }).returning();
    return row;
  },

  async createLodge(parkId: string, lodgeCode?: string | null, lodgeName?: string | null) {
    const [row] = await db.insert(lodges).values({ park_id: parkId, lodge_code: lodgeCode || null, lodge_name: lodgeName || null }).returning();
    return row;
  },
};
