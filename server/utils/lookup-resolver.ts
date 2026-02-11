import { db } from "../config/database";
import {
  package_type, tour_operator, airport, accomodation_list,
  board_basis, destination, resorts,
} from "@shared/schema";

export interface LookupMaps {
  packageType: Map<string, string>;
  tourOperator: Map<string, string>;
  airport: Map<string, string>;
  accommodation: Map<string, string>;
  boardBasis: Map<string, string>;
  destination: Map<string, string>;
  resort: Map<string, string>;
}

export async function buildLookupMaps(): Promise<LookupMaps> {
  const [packageTypes, tourOperators, airports, accommodations, boardBases, destinations, resortList] = await Promise.all([
    db.select().from(package_type),
    db.select().from(tour_operator),
    db.select().from(airport),
    db.select().from(accomodation_list),
    db.select().from(board_basis),
    db.select().from(destination),
    db.select().from(resorts),
  ]);

  return {
    packageType: new Map(packageTypes.map(r => [r.id, r.name])),
    tourOperator: new Map(tourOperators.map(r => [r.id, r.name || ""])),
    airport: new Map(airports.map(r => [r.id, `${r.airport_name} (${r.airport_code})`])),
    accommodation: new Map(accommodations.map(r => [r.id, r.name])),
    boardBasis: new Map(boardBases.map(r => [r.id, r.type])),
    destination: new Map(destinations.map(r => [r.id, r.name])),
    resort: new Map(resortList.map(r => [r.id, r.name])),
  };
}

export function resolve(map: Map<string, string>, id: string | null | undefined): string | null {
  if (!id) return null;
  return map.get(id) || null;
}

export function enrichFlights(flights: any[], maps: LookupMaps) {
  return flights.map(f => ({
    ...f,
    departing_airport_name: resolve(maps.airport, f.departing_airport_id),
    arrival_airport_name: resolve(maps.airport, f.arrival_airport_id),
    tour_operator_name: resolve(maps.tourOperator, f.tour_operator_id),
  }));
}

export function enrichAccommodations(accommodations: any[], maps: LookupMaps) {
  return accommodations.map(a => ({
    ...a,
    accomodation_name: resolve(maps.accommodation, a.accomodation_id),
    board_basis_name: resolve(maps.boardBasis, a.board_basis_id),
    tour_operator_name: resolve(maps.tourOperator, a.tour_operator_id),
  }));
}

export function enrichTransfers(transfers: any[], maps: LookupMaps) {
  return transfers.map(t => ({
    ...t,
    tour_operator_name: resolve(maps.tourOperator, t.tour_operator_id),
  }));
}

export function enrichCarHires(carHires: any[], maps: LookupMaps) {
  return carHires.map(c => ({
    ...c,
    tour_operator_name: resolve(maps.tourOperator, c.tour_operator_id),
  }));
}

export function enrichAttractionTickets(tickets: any[], maps: LookupMaps) {
  return tickets.map(t => ({
    ...t,
    tour_operator_name: resolve(maps.tourOperator, t.tour_operator_id),
  }));
}

export function enrichLoungePasses(passes: any[], maps: LookupMaps) {
  return passes.map(p => ({
    ...p,
    airport_name: resolve(maps.airport, p.airport_id),
    tour_operator_name: resolve(maps.tourOperator, p.tour_operator_id),
  }));
}

export function enrichAirportParkings(parkings: any[], maps: LookupMaps) {
  return parkings.map(p => ({
    ...p,
    airport_name: resolve(maps.airport, p.airport_id),
    tour_operator_name: resolve(maps.tourOperator, p.tour_operator_id),
  }));
}

export function enrichCruises(cruises: any[], maps: LookupMaps) {
  return cruises.map(c => ({
    ...c,
    tour_operator_name: resolve(maps.tourOperator, c.tour_operator_id),
  }));
}

export function enrichQuoteOrBooking(record: any, maps: LookupMaps) {
  return {
    ...record,
    holiday_type_name: resolve(maps.packageType, record.holiday_type_id),
    main_tour_operator_name: resolve(maps.tourOperator, record.main_tour_operator_id),
  };
}

export function enrichEnquiryRelations(relations: {
  destinations: any[];
  resorts: any[];
  accommodations: any[];
  boardBases: any[];
  airports: any[];
}, maps: LookupMaps) {
  return {
    destinations: relations.destinations.map(d => ({
      ...d,
      destination_name: resolve(maps.destination, d.destination_id),
    })),
    resorts: relations.resorts.map(r => ({
      ...r,
      resort_name: resolve(maps.resort, r.resorts_id),
    })),
    accommodations: relations.accommodations.map(a => ({
      ...a,
      accomodation_name: resolve(maps.accommodation, a.accomodation_id),
    })),
    boardBases: relations.boardBases.map(b => ({
      ...b,
      board_basis_name: resolve(maps.boardBasis, b.board_basis_id),
    })),
    airports: relations.airports.map(a => ({
      ...a,
      airport_name: resolve(maps.airport, a.airport_id),
    })),
  };
}
