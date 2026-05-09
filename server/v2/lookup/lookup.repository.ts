import { db } from '../config/database';
import {
  country,
  destination,
  resorts,
  accomodation_list,
  accomodation_type,
  board_basis,
  park,
  lodges,
  cottages,
  package_type,
  room_type,
  accommodation_images,
  lodge_images,
  cruise_line,
  cruise_ship,
  cruise_itenary,
} from '@shared/schema';
import { eq, ilike, and } from 'drizzle-orm';

export const lookupRepository = {
  async getCountries() {
    return db.select().from(country).orderBy(country.country_name);
  },

  async getDestinations(opts: { countryId?: string; search?: string; limit?: number }) {
    const conditions = [
      ...(opts.countryId ? [eq(destination.country_id, opts.countryId)] : []),
      ...(opts.search ? [ilike(destination.name, `%${opts.search}%`)] : []),
    ];

    let query = db.select().from(destination);
    if (conditions.length === 1) query = query.where(conditions[0]) as any;
    else if (conditions.length > 1) query = query.where(and(...conditions)) as any;

    let ordered = query.orderBy(destination.name) as any;
    if (opts.limit) ordered = ordered.limit(opts.limit);
    return ordered;
  },

  async getResorts(opts: { destinationId?: string; countryId?: string; search?: string; limit?: number }) {
    const conditions = [
      ...(opts.destinationId ? [eq(resorts.destination_id, opts.destinationId)] : []),
      ...(opts.countryId ? [eq(destination.country_id, opts.countryId)] : []),
      ...(opts.search ? [ilike(resorts.name, `%${opts.search}%`)] : []),
    ];

    let query = db
      .select({
        id: resorts.id,
        name: resorts.name,
        destination_id: resorts.destination_id,
        destination_name: destination.name,
        country_id: destination.country_id,
      })
      .from(resorts)
      .leftJoin(destination, eq(resorts.destination_id, destination.id));

    if (conditions.length === 1) query = query.where(conditions[0]) as any;
    else if (conditions.length > 1) query = query.where(and(...conditions)) as any;

    let finalQuery = query.orderBy(resorts.name) as any;
    if (opts.limit) finalQuery = finalQuery.limit(opts.limit);
    return finalQuery;
  },

  async getAccommodations(opts: { resortId?: string; destinationId?: string; countryId?: string; search?: string; limit?: number }) {
    const conditions = [
      ...(opts.resortId ? [eq(accomodation_list.resorts_id, opts.resortId)] : []),
      ...(opts.destinationId ? [eq(resorts.destination_id, opts.destinationId)] : []),
      ...(opts.countryId ? [eq(destination.country_id, opts.countryId)] : []),
      ...(opts.search ? [ilike(accomodation_list.name, `%${opts.search}%`)] : []),
    ];

    let query = db
      .select({
        id: accomodation_list.id,
        name: accomodation_list.name,
        type_id: accomodation_list.type_id,
        description: accomodation_list.description,
        resorts_id: accomodation_list.resorts_id,
        resort_name: resorts.name,
        destination_id: resorts.destination_id,
        destination_name: destination.name,
        country_id: destination.country_id,
      })
      .from(accomodation_list)
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id));

    if (conditions.length === 1) query = query.where(conditions[0]) as any;
    else if (conditions.length > 1) query = query.where(and(...conditions)) as any;

    let ordered = query.orderBy(accomodation_list.name) as any;
    if (opts.limit) ordered = ordered.limit(opts.limit);
    return ordered;
  },

  async getBoardBasis() {
    return db.select().from(board_basis).orderBy(board_basis.type);
  },

  async getParks(parkId?: string) {
    let query = db.select().from(park);
    if (parkId) query = query.where(eq(park.id, parkId)) as any;
    return query.orderBy(park.name);
  },

  async getLodges(parkId?: string) {
    let query = db.select().from(lodges);
    if (parkId) query = query.where(eq(lodges.park_id, parkId)) as any;
    return query.orderBy(lodges.lodge_name);
  },

  async getPackageTypes() {
    const allowedNames = ['Package Holiday', 'Cruise Package', 'Hot Tub Break', 'Others'];
    const rows = await db.select().from(package_type).orderBy(package_type.name);
    return rows.filter((r) => allowedNames.includes(r.name));
  },

  async getAccommodationTypes() {
    return db.select().from(accomodation_type).orderBy(accomodation_type.type);
  },

  async getCottages() {
    return db.select().from(cottages).orderBy(cottages.cottage_name);
  },

  async getRoomTypes() {
    return db.select().from(room_type).orderBy(room_type.name);
  },

  async getAccommodationImages(accommodationId: string) {
    return db
      .select()
      .from(accommodation_images)
      .where(eq(accommodation_images.accommodation_id, accommodationId));
  },

  async getLodgeImages(lodgeId: string) {
    return db
      .select()
      .from(lodge_images)
      .where(eq(lodge_images.lodge_id, lodgeId));
  },

  async getCruiseLines() {
    return db.select().from(cruise_line).orderBy(cruise_line.name);
  },

  async getShips(cruiseLineId?: string) {
    let query = db.select().from(cruise_ship);
    if (cruiseLineId) query = query.where(eq(cruise_ship.cruise_line_id, cruiseLineId)) as any;
    return query.orderBy(cruise_ship.name);
  },

  async getCruiseItineraries(shipId: string) {
    return db
      .select()
      .from(cruise_itenary)
      .where(eq(cruise_itenary.ship_id, shipId))
      .orderBy(cruise_itenary.date);
  },
};
