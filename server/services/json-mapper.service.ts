import { jsonMapperRepository } from "../repositories/json-mapper.repository";

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
}

interface JsonMappingResult {
  countryId: string;
  destinationId: string;
  resortId: string;
  accommodationId: string;
  boardBasisId: string;
  tourOperatorId: string;
  outboundDepartAirportId: string;
  outboundArriveAirportId: string;
  inboundDepartAirportId: string;
  inboundArriveAirportId: string;
  roomTypeId: string;
  isLodge: boolean;
  lodgeId: string;
  parkId: string;
  warnings: string[];
}

export const jsonMapperService = {
  /**
   * Map JSON text values to database IDs
   * Strategy: 
   * 1. Check if accommodation exists → get full hierarchy from it
   * 2. If not, create the hierarchy: country → destination → resort → accommodation
   */
  async mapJsonToIds(input: JsonMappingInput): Promise<JsonMappingResult> {
    console.log("🔍 JSON Mapper Service - Input received:", input);
    
    const warnings: string[] = [];
    let countryId = "";
    let destinationId = "";
    let resortId = "";
    let accommodationId = "";
    let boardBasisId = "";
    let tourOperatorId = "";
    let roomTypeId = "";
    let lodgeId = "";
    let parkId = "";

    // Detect lodge quotes from multiple signals:
    // 1. Explicit isLodgeQuote flag from frontend
    // 2. Lodge-specific fields present (parkName, lodgeCode, lodgeName)
    // 3. Tour operator is a known lodge operator
    const knownLodgeOperators = ["hoseasons", "haven", "parkdean", "park dean", "butlins", "center parcs", "centre parcs", "away resorts", "park holidays"];
    const tourOpLower = (input.tourOperator || "").toLowerCase().trim();
    const isLodgeTourOperator = knownLodgeOperators.some(op => tourOpLower.includes(op));
    const isLodge = input.isLodgeQuote || !!input.parkName || !!input.lodgeName || isLodgeTourOperator;

    if (isLodge) {
      console.log("🏠 Lodge quote detected! Treating resort as park, accommodation as lodge");
      console.log("🏠 Detection signals:", { isLodgeQuote: input.isLodgeQuote, hasParkName: !!input.parkName, hasLodgeName: !!input.lodgeName, isLodgeTourOperator, tourOperator: input.tourOperator });
      if (!input.parkName && input.resort) {
        input.parkName = input.resort;
      }
      if (!input.lodgeName && input.accommodation) {
        input.lodgeName = input.accommodation;
      }
    }

    // Strategy 1: Check if accommodation exists first (most efficient)
    // Skip this for lodge quotes - they use the park/lodge path instead
    if (input.accommodation && !isLodge) {
      console.log(`  → Searching for accommodation: "${input.accommodation}"`);
      const existingAccom = await jsonMapperRepository.findAccommodationByName(input.accommodation);
      
      if (existingAccom) {
        // Accommodation exists! Get the full hierarchy from it
        accommodationId = existingAccom.id;
        
        const hierarchy = await jsonMapperRepository.getHierarchyFromAccommodation(existingAccom.id);
        
        if (hierarchy) {
          resortId = hierarchy.resort?.id || "";
          destinationId = hierarchy.destination?.id || "";
          countryId = hierarchy.country?.id || "";
          
          console.log(`✅ Found existing accommodation hierarchy:`, {
            accommodation: existingAccom.name,
            resort: hierarchy.resort?.name,
            destination: hierarchy.destination?.name,
            country: hierarchy.country?.country_name,
          });
        }
        
        console.log(`✅ Found existing accommodation: ${input.accommodation}`);
      } else {
        // Accommodation doesn't exist - we need to create the full hierarchy
        console.log(`⚠️ Accommodation "${input.accommodation}" not found. Creating hierarchy...`);
        
        // Step 1: Ensure country exists
        if (input.country) {
          let countryRecord = await jsonMapperRepository.findCountryByName(input.country);
          if (!countryRecord) {
            console.log(`  → Creating country: ${input.country}`);
            countryRecord = await jsonMapperRepository.createCountry(input.country);
            warnings.push(`Created new country: "${input.country}"`);
          }
          countryId = countryRecord.id;
        } else {
          warnings.push(`Cannot create accommodation without country`);
        }

        // Step 2: Ensure destination exists
        if (input.destination && countryId) {
          let destRecord = await jsonMapperRepository.findDestinationByName(input.destination, countryId);
          if (!destRecord) {
            console.log(`  → Creating destination: ${input.destination}`);
            destRecord = await jsonMapperRepository.createDestination(input.destination, countryId);
            warnings.push(`Created new destination: "${input.destination}"`);
          }
          destinationId = destRecord.id;
        } else if (input.destination) {
          warnings.push(`Cannot create destination without country`);
        }

        // Step 3: Ensure resort exists
        if (input.resort && destinationId) {
          let resortRecord = await jsonMapperRepository.findResortByName(input.resort, destinationId);
          if (!resortRecord) {
            console.log(`  → Creating resort: ${input.resort}`);
            resortRecord = await jsonMapperRepository.createResort(input.resort, destinationId);
            warnings.push(`Created new resort: "${input.resort}"`);
          }
          resortId = resortRecord.id;
        } else if (input.resort) {
          warnings.push(`Cannot create resort without destination`);
        }

        // Step 4: Create accommodation
        if (resortId) {
          console.log(`  → Creating accommodation: ${input.accommodation}`);
          const newAccom = await jsonMapperRepository.createAccommodation(input.accommodation, resortId);
          accommodationId = newAccom.id;
          warnings.push(`Created new accommodation: "${input.accommodation}"`);
        } else {
          warnings.push(`Cannot create accommodation without resort`);
        }
      }
    } else {
      // No accommodation provided, just try to match country/destination/resort
      if (input.country) {
        const countryRecord = await jsonMapperRepository.findCountryByName(input.country);
        if (countryRecord) {
          countryId = countryRecord.id;
        } else {
          warnings.push(`Country "${input.country}" not found`);
        }
      }

      if (input.destination) {
        const dest = await jsonMapperRepository.findDestinationByName(input.destination, countryId || undefined);
        if (dest) {
          destinationId = dest.id;
          if (!countryId && dest.country_id) {
            countryId = dest.country_id;
          }
        } else {
          warnings.push(`Destination "${input.destination}" not found`);
        }
      }

      if (input.resort) {
        const resortRecord = await jsonMapperRepository.findResortByName(input.resort, destinationId || undefined);
        if (resortRecord) {
          resortId = resortRecord.id;
        } else {
          warnings.push(`Resort "${input.resort}" not found`);
        }
      }
    }

    // Map board basis (create if doesn't exist)
    if (input.boardBasis) {
      let board = await jsonMapperRepository.findBoardBasisByType(input.boardBasis);
      if (!board) {
        console.log(`  → Creating board basis: ${input.boardBasis}`);
        board = await jsonMapperRepository.createBoardBasis(input.boardBasis);
        warnings.push(`Created new board basis: "${input.boardBasis}"`);
      }
      boardBasisId = board.id;
    }

    // Map tour operator (create if doesn't exist)
    if (input.tourOperator) {
      let tourOp = await jsonMapperRepository.findTourOperatorByName(input.tourOperator);
      if (!tourOp) {
        console.log(`  → Creating tour operator: ${input.tourOperator}`);
        tourOp = await jsonMapperRepository.createTourOperator(input.tourOperator);
        warnings.push(`Created new tour operator: "${input.tourOperator}"`);
      }
      tourOperatorId = tourOp.id;
    }

    // Map airports (find or warn - we don't auto-create airports as they need country_id)
    const mapAirport = async (codeOrName: string): Promise<string> => {
      if (!codeOrName) return "";
      const airportRecord = await jsonMapperRepository.findAirportByCodeOrName(codeOrName);
      if (airportRecord) {
        return airportRecord.id;
      }
      warnings.push(`Airport "${codeOrName}" not found in database`);
      return "";
    };

    const outboundDepartAirportId = await mapAirport(input.outboundDepartAirport || "");
    const outboundArriveAirportId = await mapAirport(input.outboundArriveAirport || "");
    const inboundDepartAirportId = await mapAirport(input.inboundDepartAirport || "");
    const inboundArriveAirportId = await mapAirport(input.inboundArriveAirport || "");

    // Map room type (create if doesn't exist)
    if (input.roomType) {
      console.log(`🚪 JSON Mapper - Processing room type: "${input.roomType}"`);
      let room = await jsonMapperRepository.findRoomTypeByName(input.roomType);
      
      if (!room) {
        console.log(`  → Room type "${input.roomType}" not found, creating new one...`);
        room = await jsonMapperRepository.createRoomType(input.roomType);
        
        if (!room) {
          console.error(`❌ Failed to create room type "${input.roomType}" - returned null/undefined`);
          warnings.push(`Failed to create room type: "${input.roomType}"`);
        } else if (!room.id) {
          console.error(`❌ Created room type "${input.roomType}" but no ID was returned:`, room);
          warnings.push(`Room type created but no ID returned: "${input.roomType}"`);
        } else {
          console.log(`✅ Successfully created room type "${input.roomType}" with ID: ${room.id}`);
          warnings.push(`Created new room type: "${input.roomType}"`);
          roomTypeId = room.id;
        }
      } else {
        console.log(`✅ Found existing room type "${input.roomType}" with ID: ${room.id}`);
        roomTypeId = room.id;
      }
    }

    // Map park: find by name, create if missing (using parkCode as the park's code field)
    if (input.parkName) {
      let parkRecord = await jsonMapperRepository.findParkByName(input.parkName);
      if (!parkRecord && input.parkCode) {
        parkRecord = await jsonMapperRepository.findParkByCode(input.parkCode);
      }
      if (parkRecord) {
        parkId = parkRecord.id;
        console.log(`✅ Found park: ${input.parkName}`);
      } else {
        console.log(`  → Creating park: ${input.parkName}`);
        parkRecord = await jsonMapperRepository.createPark(input.parkName, input.parkCode || undefined);
        parkId = parkRecord.id;
        warnings.push(`Created new park: "${input.parkName}"`);
      }
    }

    // Map lodge: try by code first, then by name, create if not found
    if (input.lodgeCode) {
      const lodge = await jsonMapperRepository.findLodgeByCode(input.lodgeCode);
      if (lodge) {
        lodgeId = lodge.id;
        console.log(`✅ Found lodge by code: ${input.lodgeCode}`);
      }
    }
    if (!lodgeId && input.lodgeName) {
      const lodge = await jsonMapperRepository.findLodgeByName(input.lodgeName);
      if (lodge) {
        lodgeId = lodge.id;
        console.log(`✅ Found lodge by name: ${input.lodgeName}`);
      }
    }
    // Auto-create lodge if not found and we have a park
    if (!lodgeId && parkId && (input.lodgeCode || input.lodgeName)) {
      console.log(`  → Creating lodge: code=${input.lodgeCode}, name=${input.lodgeName}, parkId=${parkId}`);
      const newLodge = await jsonMapperRepository.createLodge(parkId, input.lodgeCode, input.lodgeName);
      lodgeId = newLodge.id;
      warnings.push(`Created new lodge: "${input.lodgeName || input.lodgeCode}"`);
    }

    console.log("📊 Final mapping result:", {
      countryId,
      destinationId,
      resortId,
      accommodationId,
      boardBasisId,
      tourOperatorId,
      outboundDepartAirportId,
      outboundArriveAirportId,
      inboundDepartAirportId,
      inboundArriveAirportId,
      roomTypeId,
      lodgeId,
      parkId,
      warnings,
    });

    return {
      countryId,
      destinationId,
      resortId,
      accommodationId,
      boardBasisId,
      tourOperatorId,
      outboundDepartAirportId,
      outboundArriveAirportId,
      inboundDepartAirportId,
      inboundArriveAirportId,
      roomTypeId,
      isLodge,
      lodgeId,
      parkId,
      warnings,
    };
  },
};
