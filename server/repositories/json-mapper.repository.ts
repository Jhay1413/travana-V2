import { db } from "../config/database";
import { 
  country, 
  destination, 
  resorts, 
  accomodation_list, 
  board_basis, 
  tour_operator, 
  airport,
  room_type 
} from "@shared/schema";
import { ilike, and, eq, or } from "drizzle-orm";

export const jsonMapperRepository = {
  /**
   * Find country by name (case-insensitive)
   */
  async findCountryByName(name: string) {
    if (!name) return null;
    
    const results = await db
      .select()
      .from(country)
      .where(ilike(country.country_name, `%${name}%`))
      .limit(1);
    
    return results[0] || null;
  },

  /**
   * Find destination by name, optionally filtered by country
   */
  async findDestinationByName(name: string, countryId?: string) {
    if (!name) return null;
    
    const conditions = [ilike(destination.name, `%${name}%`)];
    if (countryId) {
      conditions.push(eq(destination.country_id, countryId));
    }
    
    const results = await db
      .select()
      .from(destination)
      .where(and(...conditions))
      .limit(1);
    
    return results[0] || null;
  },

  /**
   * Find resort by name, optionally filtered by destination
   */
  async findResortByName(name: string, destinationId?: string) {
    if (!name) return null;
    
    const conditions = [ilike(resorts.name, `%${name}%`)];
    if (destinationId) {
      conditions.push(eq(resorts.destination_id, destinationId));
    }
    
    const results = await db
      .select()
      .from(resorts)
      .where(and(...conditions))
      .limit(1);
    
    return results[0] || null;
  },

  /**
   * Find accommodation by name, optionally filtered by resort
   */
  async findAccommodationByName(name: string, resortId?: string) {
    if (!name) return null;
    
    const conditions = [ilike(accomodation_list.name, `%${name}%`)];
    if (resortId) {
      conditions.push(eq(accomodation_list.resorts_id, resortId));
    }
    
    const results = await db
      .select()
      .from(accomodation_list)
      .where(and(...conditions))
      .limit(1);
    
    return results[0] || null;
  },

  /**
   * Find board basis by type name
   */
  async findBoardBasisByType(typeName: string) {
    if (!typeName) return null;
    
    const results = await db
      .select()
      .from(board_basis)
      .where(ilike(board_basis.type, `%${typeName}%`))
      .limit(1);
    
    return results[0] || null;
  },

  /**
   * Find tour operator by name
   */
  async findTourOperatorByName(name: string) {
    if (!name) return null;
    
    const results = await db
      .select()
      .from(tour_operator)
      .where(ilike(tour_operator.name, `%${name}%`))
      .limit(1);
    
    return results[0] || null;
  },

  /**
   * Find airport by code or name
   */
  async findAirportByCodeOrName(codeOrName: string) {
    if (!codeOrName) return null;
    
    const normalized = codeOrName.toUpperCase().trim();
    
    // First try exact code match
    const codeResults = await db
      .select()
      .from(airport)
      .where(eq(airport.airport_code, normalized))
      .limit(1);
    
    if (codeResults[0]) return codeResults[0];
    
    // Then try name match
    const nameResults = await db
      .select()
      .from(airport)
      .where(ilike(airport.airport_name, `%${codeOrName}%`))
      .limit(1);
    
    return nameResults[0] || null;
  },

  /**
   * Find room type by name
   */
  async findRoomTypeByName(name: string) {
    if (!name) return null;
    
    const results = await db
      .select()
      .from(room_type)
      .where(ilike(room_type.name, `%${name}%`))
      .limit(1);
    
    return results[0] || null;
  },

  /**
   * Reverse lookup: Get country, destination, resort from accommodation
   */
  async getHierarchyFromAccommodation(accommodationId: string) {
    const results = await db
      .select({
        accommodation: accomodation_list,
        resort: resorts,
        destination: destination,
        country: country,
      })
      .from(accomodation_list)
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(eq(accomodation_list.id, accommodationId))
      .limit(1);
    
    return results[0] || null;
  },

  /**
   * Create country if it doesn't exist
   */
  async createCountry(name: string) {
    const results = await db
      .insert(country)
      .values({ country_name: name })
      .returning();
    
    return results[0];
  },

  /**
   * Create destination if it doesn't exist
   */
  async createDestination(name: string, countryId: string) {
    const results = await db
      .insert(destination)
      .values({ name, country_id: countryId })
      .returning();
    
    return results[0];
  },

  /**
   * Create resort if it doesn't exist
   */
  async createResort(name: string, destinationId: string) {
    const results = await db
      .insert(resorts)
      .values({ name, destination_id: destinationId })
      .returning();
    
    return results[0];
  },

  /**
   * Create accommodation if it doesn't exist
   */
  async createAccommodation(name: string, resortId: string) {
    const results = await db
      .insert(accomodation_list)
      .values({ name, resorts_id: resortId })
      .returning();
    
    return results[0];
  },

  /**
   * Create board basis if it doesn't exist
   */
  async createBoardBasis(typeName: string) {
    const results = await db
      .insert(board_basis)
      .values({ type: typeName })
      .returning();
    
    return results[0];
  },

  /**
   * Create tour operator if it doesn't exist
   */
  async createTourOperator(name: string) {
    const results = await db
      .insert(tour_operator)
      .values({ name })
      .returning();
    
    return results[0];
  },

  /**
   * Create room type if it doesn't exist
   */
  async createRoomType(name: string) {
    const results = await db
      .insert(room_type)
      .values({ name })
      .returning();
    
    return results[0];
  },

  /**
   * Create airport if it doesn't exist
   */
  async createAirport(name: string, code: string) {
    const results = await db
      .insert(airport)
      .values({ airport_name: name, airport_code: code })
      .returning();
    
    return results[0];
  },
};
