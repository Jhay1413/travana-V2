import { jsonMapperRepository } from './json-mapper.repository';
import { cruiseSettingsRepository } from '../../settings/cruise/cruise.repository';

interface CruiseItineraryDayInput {
  day?: number | string;
  description?: string;
}

interface JsonMappingInput {
  country?: string;
  destination?: string;
  resort?: string;
  accommodation?: string;
  boardBasis?: string;
  tourOperator?: string;
  outboundDepartAirport?: string;
  outboundArriveAirport?: string;
  inboundDepartAirport?: string;
  inboundArriveAirport?: string;
  roomType?: string;
  lodgeCode?: string | null;
  lodgeName?: string;
  parkName?: string;
  parkCode?: string | null;
  isLodgeQuote?: boolean;
  // Cruise catalog (find-or-create)
  cruiseLine?: string;
  shipName?: string;
  cruiseDate?: string;
  embarkation?: string;
  cruiseTitle?: string;
  cruiseItinerary?: CruiseItineraryDayInput[];
}

export const jsonMapperService = {
  async mapJsonToIds(input: JsonMappingInput) {
    const warnings: string[] = [];
    let countryId = '';
    let destinationId = '';
    let resortId = '';
    let accommodationId = '';
    let boardBasisId = '';
    let tourOperatorId = '';
    let roomTypeId = '';
    let lodgeId = '';
    let parkId = '';

    const knownLodgeOperators = ['hoseasons', 'haven', 'parkdean', 'park dean', 'butlins', 'center parcs', 'centre parcs', 'away resorts', 'park holidays'];
    const tourOpLower = (input.tourOperator || '').toLowerCase().trim();
    const isLodgeTourOperator = knownLodgeOperators.some((op) => tourOpLower.includes(op));
    const isLodge = input.isLodgeQuote || !!input.parkName || !!input.lodgeName || isLodgeTourOperator;

    if (isLodge) {
      if (!input.parkName && input.resort) input.parkName = input.resort;
      if (!input.lodgeName && input.accommodation) input.lodgeName = input.accommodation;
    }

    if (input.accommodation && !isLodge) {
      const existingAccom = await jsonMapperRepository.findAccommodationByName(input.accommodation);
      if (existingAccom) {
        accommodationId = existingAccom.id;
        const hierarchy = await jsonMapperRepository.getHierarchyFromAccommodation(existingAccom.id);
        if (hierarchy) {
          resortId = hierarchy.resort?.id || '';
          destinationId = hierarchy.destination?.id || '';
          countryId = hierarchy.country?.id || '';
        }
      } else {
        if (input.country) {
          let countryRecord = await jsonMapperRepository.findCountryByName(input.country);
          if (!countryRecord) { countryRecord = await jsonMapperRepository.createCountry(input.country); warnings.push(`Created new country: "${input.country}"`); }
          countryId = countryRecord.id;
        } else { warnings.push('Cannot create accommodation without country'); }

        if (input.destination && countryId) {
          let destRecord = await jsonMapperRepository.findDestinationByName(input.destination, countryId);
          if (!destRecord) { destRecord = await jsonMapperRepository.createDestination(input.destination, countryId); warnings.push(`Created new destination: "${input.destination}"`); }
          destinationId = destRecord.id;
        } else if (input.destination) { warnings.push('Cannot create destination without country'); }

        if (input.resort && destinationId) {
          let resortRecord = await jsonMapperRepository.findResortByName(input.resort, destinationId);
          if (!resortRecord) { resortRecord = await jsonMapperRepository.createResort(input.resort, destinationId); warnings.push(`Created new resort: "${input.resort}"`); }
          resortId = resortRecord.id;
        } else if (input.resort) { warnings.push('Cannot create resort without destination'); }

        if (resortId) {
          const newAccom = await jsonMapperRepository.createAccommodation(input.accommodation, resortId);
          accommodationId = newAccom.id;
          warnings.push(`Created new accommodation: "${input.accommodation}"`);
        } else { warnings.push('Cannot create accommodation without resort'); }
      }
    } else {
      if (input.country) {
        const countryRecord = await jsonMapperRepository.findCountryByName(input.country);
        if (countryRecord) countryId = countryRecord.id;
        else warnings.push(`Country "${input.country}" not found`);
      }
      if (input.destination) {
        const dest = await jsonMapperRepository.findDestinationByName(input.destination, countryId || undefined);
        if (dest) { destinationId = dest.id; if (!countryId && dest.country_id) countryId = dest.country_id; }
        else warnings.push(`Destination "${input.destination}" not found`);
      }
      if (input.resort) {
        const resortRecord = await jsonMapperRepository.findResortByName(input.resort, destinationId || undefined);
        if (resortRecord) resortId = resortRecord.id;
        else warnings.push(`Resort "${input.resort}" not found`);
      }
    }

    if (input.boardBasis) {
      let board = await jsonMapperRepository.findBoardBasisByType(input.boardBasis);
      if (!board) { board = await jsonMapperRepository.createBoardBasis(input.boardBasis); warnings.push(`Created new board basis: "${input.boardBasis}"`); }
      boardBasisId = board.id;
    }

    if (input.tourOperator) {
      let tourOp = await jsonMapperRepository.findTourOperatorByName(input.tourOperator);
      if (!tourOp) { tourOp = await jsonMapperRepository.createTourOperator(input.tourOperator); warnings.push(`Created new tour operator: "${input.tourOperator}"`); }
      tourOperatorId = tourOp.id;
    }

    const mapAirport = async (codeOrName: string): Promise<string> => {
      if (!codeOrName) return '';
      const rec = await jsonMapperRepository.findAirportByCodeOrName(codeOrName);
      if (rec) return rec.id;
      warnings.push(`Airport "${codeOrName}" not found in database`);
      return '';
    };

    const outboundDepartAirportId = await mapAirport(input.outboundDepartAirport || '');
    const outboundArriveAirportId = await mapAirport(input.outboundArriveAirport || '');
    const inboundDepartAirportId = await mapAirport(input.inboundDepartAirport || '');
    const inboundArriveAirportId = await mapAirport(input.inboundArriveAirport || '');

    if (input.roomType) {
      let room = await jsonMapperRepository.findRoomTypeByName(input.roomType);
      if (!room) { room = await jsonMapperRepository.createRoomType(input.roomType); warnings.push(`Created new room type: "${input.roomType}"`); }
      roomTypeId = room.id;
    }

    if (input.parkName) {
      let parkRecord = await jsonMapperRepository.findParkByName(input.parkName);
      if (!parkRecord && input.parkCode) parkRecord = await jsonMapperRepository.findParkByCode(input.parkCode);
      if (parkRecord) { parkId = parkRecord.id; }
      else { parkRecord = await jsonMapperRepository.createPark(input.parkName, input.parkCode || undefined); parkId = parkRecord.id; warnings.push(`Created new park: "${input.parkName}"`); }
    }

    if (input.lodgeCode) {
      const lodge = await jsonMapperRepository.findLodgeByCode(input.lodgeCode);
      if (lodge) lodgeId = lodge.id;
    }
    if (!lodgeId && input.lodgeName) {
      const lodge = await jsonMapperRepository.findLodgeByName(input.lodgeName);
      if (lodge) lodgeId = lodge.id;
    }
    if (!lodgeId && parkId && (input.lodgeCode || input.lodgeName)) {
      const newLodge = await jsonMapperRepository.createLodge(parkId, input.lodgeCode, input.lodgeName);
      lodgeId = newLodge.id;
      warnings.push(`Created new lodge: "${input.lodgeName || input.lodgeCode}"`);
    }

    // ─── Cruise catalog: line → ship → voyage (find-or-create) ───────────────
    // Each level is scoped by its parent's id, matched exactly (case-insensitive).
    let cruiseLineId = '';
    let shipId = '';
    let cruiseItineraryId = '';

    if (input.cruiseLine) {
      let line = await cruiseSettingsRepository.findLineByName(input.cruiseLine);
      if (!line) { line = await cruiseSettingsRepository.createLine({ name: input.cruiseLine.trim() }); warnings.push(`Created new cruise line: "${input.cruiseLine}"`); }
      cruiseLineId = line.id;

      if (input.shipName && cruiseLineId) {
        let ship = await cruiseSettingsRepository.findShipByName(input.shipName, cruiseLineId);
        if (!ship) { ship = await cruiseSettingsRepository.createShip({ name: input.shipName.trim(), cruise_line_id: cruiseLineId }); warnings.push(`Created new ship: "${input.shipName}"`); }
        shipId = ship.id;

        if (input.cruiseDate && shipId) {
          // A voyage is uniquely a ship sailing on a given date.
          let itin = await cruiseSettingsRepository.findItineraryByShipAndDate(shipId, input.cruiseDate);
          if (!itin) {
            itin = await cruiseSettingsRepository.createItinerary({
              ship_id: shipId,
              date: input.cruiseDate,
              departure_port: input.embarkation?.trim() || 'Unknown',
              itenary: input.cruiseTitle?.trim() || null,
            });
            warnings.push(`Created new cruise voyage: "${input.shipName} – ${input.cruiseDate}"`);
          }
          cruiseItineraryId = itin.id;

          // Day-by-day plan (catalog cruise_voyage) — create any missing days.
          if (Array.isArray(input.cruiseItinerary) && cruiseItineraryId) {
            for (const day of input.cruiseItinerary) {
              const dayNo = Number(day?.day);
              if (!Number.isFinite(dayNo)) continue;
              const existingDay = await cruiseSettingsRepository.findVoyageByDay(cruiseItineraryId, dayNo);
              if (!existingDay) await cruiseSettingsRepository.createVoyage(cruiseItineraryId, dayNo, day?.description || '');
            }
          }
        }
      }
    }

    return { countryId, destinationId, resortId, accommodationId, boardBasisId, tourOperatorId, outboundDepartAirportId, outboundArriveAirportId, inboundDepartAirportId, inboundArriveAirportId, roomTypeId, isLodge, lodgeId, parkId, cruiseLineId, shipId, cruiseItineraryId, warnings };
  },
};
