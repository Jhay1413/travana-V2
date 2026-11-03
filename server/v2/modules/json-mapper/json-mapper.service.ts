import { jsonMapperRepository } from './json-mapper.repository';
import { cruiseSettingsRepository } from '../../settings/cruise/cruise.repository';
import { geoInferenceAiService, type InferredGeo } from './geo-inference.ai.service';
import { tourOperatorLinkService } from '../tour-operator/tour-operator-link.service';
import { findSeedCommission } from '@shared/tour-operator-seed';

interface CruiseItineraryDayInput {
  day?: number | string;
  description?: string;
  subDescription?: string;
}

// A line item that maps to an accommodation row (primary or extra/pre-post stay).
interface AccommodationLineInput {
  country?: string;
  destination?: string;
  resort?: string;
  accommodation?: string;
  boardBasis?: string;
  roomType?: string;
  tourOperator?: string;
  // Context for AI geo inference only (primary stay); never persisted.
  arrivalAirportName?: string;
  quoteTitle?: string;
}

// Line items that only need a tour operator resolved (transfers, car hire, attractions).
interface TourOpLineInput {
  tourOperator?: string;
}

// Line items that need a tour operator + an airport resolved (lounge passes, parking).
interface AirportLineInput {
  tourOperator?: string;
  airport?: string;
}

interface JsonMappingInput {
  country?: string;
  destination?: string;
  resort?: string;
  accommodation?: string;
  boardBasis?: string;
  tourOperator?: string;
  quoteTitle?: string;
  outboundDepartAirport?: string;
  outboundArriveAirport?: string;
  inboundDepartAirport?: string;
  inboundArriveAirport?: string;
  outboundDepartAirportName?: string;
  outboundArriveAirportName?: string;
  inboundDepartAirportName?: string;
  inboundArriveAirportName?: string;
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
  // Line-item arrays — resolved in this same call so the client only round-trips once.
  // Works for any package type (package holiday, hot tub / lodge, cruise).
  extraAccommodations?: AccommodationLineInput[];
  transfers?: TourOpLineInput[];
  carHires?: TourOpLineInput[];
  attractionTickets?: TourOpLineInput[];
  loungePasses?: AirportLineInput[];
  airportParkings?: AirportLineInput[];
}

export const jsonMapperService = {
  // `orgId` / `userId` are used only to link a resolved tour operator to the
  // caller's organisation (the catalogue itself is global). Optional so nothing
  // else that calls this has to change; without an orgId no link is made.
  async mapJsonToIds(input: JsonMappingInput, orgId?: string | null, userId?: string | null, canWrite = false) {
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

    // ─── Cached, concurrency-safe resolvers ──────────────────────────────────
    // Each distinct name is resolved (find-or-create) exactly once per request,
    // even when many line items reference it. Caching Promises (not values) means
    // concurrent lookups for the same name share one DB round-trip / create.
    const norm = (s?: string | null) => (s || '').trim().toLowerCase();

    // Tour operators are a platform-wide catalogue. Resolve the name there
    // (exact, then contains), create the catalogue row when it is missing, then
    // make sure THIS org has a link to it: the quote form's dropdown lists the
    // org's links, so an id without a link would render blank. A link made here
    // has no commission yet (NULL) for the agency to fill in.
    const tourOpCache = new Map<string, Promise<string>>();
    const resolveTourOperator = (name?: string | null): Promise<string> => {
      const key = norm(name);
      if (!key) return Promise.resolve('');
      let p = tourOpCache.get(key);
      if (!p) {
        p = (async () => {
          // Only writers (admins / branch managers) may add to the shared catalogue
          // or to the agency's list; everyone else just resolves what exists.
          const notInList = () => {
            warnings.push(`"${name!.trim()}" isn't in your agency's tour operators. Ask an admin to add it on Tour Operators.`);
            return '';
          };
          // The agency's own list wins: "Jet2" must pick the linked "Jet2 Holidays",
          // not some other catalogue operator that merely contains the text.
          if (orgId) {
            const own = await tourOperatorLinkService.findLinkedOperatorByName(orgId, name!);
            if (own) return own.id;
          }
          let operator = await jsonMapperRepository.findCatalogueOperatorByName(name!);
          if (!operator) {
            if (!canWrite) return notInList();
            operator = await jsonMapperRepository.createCatalogueOperator(name!, userId ?? null);
            warnings.push(`Created new tour operator: "${name}"`);
          }
          if (orgId) {
            if (canWrite) {
              // A seed operator keeps its seed rate; anything else has no rate yet (NULL).
              const link = await tourOperatorLinkService.ensureLinkForOrg(orgId, operator.id, userId ?? null, findSeedCommission(operator.name));
              if (link.created) warnings.push(`Added "${operator.name}" to your tour operators`);
            } else if (!(await tourOperatorLinkService.isOperatorLinked(orgId, operator.id))) {
              return notInList();
            }
          }
          return operator.id;
        })();
        tourOpCache.set(key, p);
      }
      return p;
    };

    const boardCache = new Map<string, Promise<string>>();
    const resolveBoardBasis = (name?: string | null): Promise<string> => {
      const key = norm(name);
      if (!key) return Promise.resolve('');
      let p = boardCache.get(key);
      if (!p) {
        p = (async () => {
          let b = await jsonMapperRepository.findBoardBasisByType(name!);
          if (!b) { b = await jsonMapperRepository.createBoardBasis(name!.trim()); warnings.push(`Created new board basis: "${name}"`); }
          return b.id;
        })();
        boardCache.set(key, p);
      }
      return p;
    };

    const roomCache = new Map<string, Promise<string>>();
    const resolveRoomType = (name?: string | null): Promise<string> => {
      const key = norm(name);
      if (!key) return Promise.resolve('');
      let p = roomCache.get(key);
      if (!p) {
        p = (async () => {
          let r = await jsonMapperRepository.findRoomTypeByName(name!);
          if (!r) { r = await jsonMapperRepository.createRoomType(name!.trim()); warnings.push(`Created new room type: "${name}"`); }
          return r.id;
        })();
        roomCache.set(key, p);
      }
      return p;
    };

    const airportCache = new Map<string, Promise<string>>();
    const resolveAirport = (code?: string | null, name?: string | null): Promise<string> => {
      const lookup = (code || name || '').trim();
      const key = norm(lookup);
      if (!key) return Promise.resolve('');
      let p = airportCache.get(key);
      if (!p) {
        p = (async () => {
          const rec = await jsonMapperRepository.findAirportByCodeOrName(lookup);
          if (rec) return rec.id;
          // Not found → create it (both columns are NOT NULL, so fall back name↔code).
          const created = await jsonMapperRepository.createAirport(code?.trim() || lookup, name?.trim() || code?.trim() || lookup);
          warnings.push(`Created new airport: "${name?.trim() || lookup}"`);
          return created.id;
        })();
        airportCache.set(key, p);
      }
      return p;
    };

    // Find-or-create the full country → destination → resort → accommodation chain.
    type Hierarchy = { accommodationId: string; countryId: string; destinationId: string; resortId: string };
    const accomCache = new Map<string, Promise<Hierarchy>>();
    const resolveAccommodation = (a: AccommodationLineInput): Promise<Hierarchy> => {
      const accName = (a.accommodation || '').trim();
      if (!accName) return Promise.resolve({ accommodationId: '', countryId: '', destinationId: '', resortId: '' });
      const key = accName.toLowerCase();
      let p = accomCache.get(key);
      if (!p) {
        p = (async (): Promise<Hierarchy> => {
          const existing = await jsonMapperRepository.findAccommodationByName(accName);
          if (existing) {
            const h = await jsonMapperRepository.getHierarchyFromAccommodation(existing.id);
            return {
              accommodationId: existing.id,
              resortId: h?.resort?.id || '',
              destinationId: h?.destination?.id || '',
              countryId: h?.country?.id || '',
            };
          }
          let cId = '', dId = '', rId = '', aId = '';

          // AI gap-fill. Runs only when the scrape left a level of the chain
          // empty, and only AFTER the global accommodation lookup missed (an
          // existing hotel already carries its own hierarchy). It lives inside
          // this cached promise, so a deal repeating the same hotel across line
          // items still costs at most one call. A level the scrape provided is
          // never replaced (`a.x || inferred.x`). inferHierarchy never throws;
          // the extra catch keeps that true even if it is ever changed or mocked
          // badly — a failure must leave the import exactly as it was before.
          let inferred: InferredGeo | null = null;
          if (!a.country || !a.destination || !a.resort) {
            try {
              inferred = await geoInferenceAiService.inferHierarchy(
                {
                  accommodation: accName,
                  country: a.country,
                  destination: a.destination,
                  resort: a.resort,
                  arrivalAirportName: a.arrivalAirportName,
                  quoteTitle: a.quoteTitle,
                },
                orgId,
              );
            } catch { inferred = null; }
          }
          const country = a.country || inferred?.country || '';
          const destination = a.destination || inferred?.destination || '';
          const resort = a.resort || inferred?.resort || '';
          // Inferred values are guesses that reach a catalog shared by the whole
          // org, so every warning about them says so for the reviewing agent.
          const tag = (isInferred: boolean) => (isInferred ? ' (inferred from accommodation)' : '');
          const countryInferred = !a.country && !!country;
          const destinationInferred = !a.destination && !!destination;
          const resortInferred = !a.resort && !!resort;

          // Match before create: an AI-named level is looked up exactly like a
          // scraped one (find*ByName) and an existing row always wins. A guess
          // such as "USA" vs "United States" must not spawn a duplicate row
          // when the catalog already has the place.
          if (country) {
            let c = await jsonMapperRepository.findCountryByName(country);
            if (c) { if (countryInferred) warnings.push(`Matched existing country: "${country}"${tag(true)}`); }
            else { c = await jsonMapperRepository.createCountry(country); warnings.push(`Created new country: "${country}"${tag(countryInferred)}`); }
            cId = c.id;
          } else { warnings.push('Cannot create accommodation without country'); }

          if (destination && cId) {
            let d = await jsonMapperRepository.findDestinationByName(destination, cId);
            if (d) { if (destinationInferred) warnings.push(`Matched existing destination: "${destination}"${tag(true)}`); }
            else { d = await jsonMapperRepository.createDestination(destination, cId); warnings.push(`Created new destination: "${destination}"${tag(destinationInferred)}`); }
            dId = d.id;
          } else if (destination) { warnings.push('Cannot create destination without country'); }

          if (resort && dId) {
            let r = await jsonMapperRepository.findResortByName(resort, dId);
            if (r) { if (resortInferred) warnings.push(`Matched existing resort: "${resort}"${tag(true)}`); }
            else { r = await jsonMapperRepository.createResort(resort, dId); warnings.push(`Created new resort: "${resort}"${tag(resortInferred)}`); }
            rId = r.id;
          } else if (resort) { warnings.push('Cannot create resort without destination'); }

          if (rId) {
            // The global lookup above only accepts an EXACT name match. Now
            // that the JSON's own resort is resolved, retry within it — that
            // safely catches near-name catalog rows there (e.g. "Cala Nova
            // Apartments" for "Cala Nova") without adopting a look-alike hotel
            // from another resort, before falling back to creating the row.
            const inResort = await jsonMapperRepository.findAccommodationByName(accName, rId);
            if (inResort) {
              aId = inResort.id;
            } else {
              const na = await jsonMapperRepository.createAccommodation(accName, rId);
              aId = na.id;
              warnings.push(`Created new accommodation: "${accName}"${resortInferred ? ' (in an inferred resort)' : ''}`);
            }
          } else { warnings.push('Cannot create accommodation without resort'); }

          return { accommodationId: aId, countryId: cId, destinationId: dId, resortId: rId };
        })();
        accomCache.set(key, p);
      }
      return p;
    };

    // ─── Primary stay / lodge ────────────────────────────────────────────────
    const knownLodgeOperators = ['hoseasons', 'haven', 'parkdean', 'park dean', 'butlins', 'center parcs', 'centre parcs', 'away resorts', 'park holidays'];
    const tourOpLower = (input.tourOperator || '').toLowerCase().trim();
    const isLodgeTourOperator = knownLodgeOperators.some((op) => tourOpLower.includes(op));
    const isLodge = input.isLodgeQuote || !!input.parkName || !!input.lodgeName || isLodgeTourOperator;

    if (isLodge) {
      if (!input.parkName && input.resort) input.parkName = input.resort;
      if (!input.lodgeName && input.accommodation) input.lodgeName = input.accommodation;
    }

    if (input.accommodation && !isLodge) {
      const h = await resolveAccommodation({
        country: input.country,
        destination: input.destination,
        resort: input.resort,
        accommodation: input.accommodation,
        arrivalAirportName: input.outboundArriveAirportName,
        quoteTitle: input.quoteTitle,
      });
      accommodationId = h.accommodationId;
      resortId = h.resortId;
      destinationId = h.destinationId;
      countryId = h.countryId;
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

    boardBasisId = await resolveBoardBasis(input.boardBasis);
    tourOperatorId = await resolveTourOperator(input.tourOperator);

    const outboundDepartAirportId = await resolveAirport(input.outboundDepartAirport, input.outboundDepartAirportName);
    const outboundArriveAirportId = await resolveAirport(input.outboundArriveAirport, input.outboundArriveAirportName);
    const inboundDepartAirportId = await resolveAirport(input.inboundDepartAirport, input.inboundDepartAirportName);
    const inboundArriveAirportId = await resolveAirport(input.inboundArriveAirport, input.inboundArriveAirportName);

    roomTypeId = await resolveRoomType(input.roomType);

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
              if (!existingDay) await cruiseSettingsRepository.createVoyage(cruiseItineraryId, dayNo, day?.description || '', day?.subDescription || '');
            }
          }
        }
      }
    }

    // ─── Line items (resolved in this same call) ─────────────────────────────
    const extraAccommodations = await Promise.all(
      (input.extraAccommodations || []).map(async (a) => {
        const [h, bbId, rtId, toId] = await Promise.all([
          resolveAccommodation(a),
          resolveBoardBasis(a.boardBasis),
          resolveRoomType(a.roomType),
          resolveTourOperator(a.tourOperator),
        ]);
        return { ...h, boardBasisId: bbId, roomTypeId: rtId, tourOperatorId: toId };
      })
    );

    const resolveTourOpList = (items?: TourOpLineInput[]) =>
      Promise.all((items || []).map(async (i) => ({ tourOperatorId: await resolveTourOperator(i.tourOperator) })));

    const resolveAirportList = (items?: AirportLineInput[]) =>
      Promise.all((items || []).map(async (i) => {
        const [toId, apId] = await Promise.all([resolveTourOperator(i.tourOperator), resolveAirport(i.airport)]);
        return { tourOperatorId: toId, airportId: apId };
      }));

    const [transfers, carHires, attractionTickets, loungePasses, airportParkings] = await Promise.all([
      resolveTourOpList(input.transfers),
      resolveTourOpList(input.carHires),
      resolveTourOpList(input.attractionTickets),
      resolveAirportList(input.loungePasses),
      resolveAirportList(input.airportParkings),
    ]);

    return {
      countryId, destinationId, resortId, accommodationId, boardBasisId, tourOperatorId,
      outboundDepartAirportId, outboundArriveAirportId, inboundDepartAirportId, inboundArriveAirportId,
      roomTypeId, isLodge, lodgeId, parkId, cruiseLineId, shipId, cruiseItineraryId,
      extraAccommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings,
      warnings,
    };
  },
};
