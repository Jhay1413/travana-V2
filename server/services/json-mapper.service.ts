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

    // Strategy 1: Check if accommodation exists first (most efficient)
    if (input.accommodation) {
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
      let room = await jsonMapperRepository.findRoomTypeByName(input.roomType);
      if (!room) {
        console.log(`  → Creating room type: ${input.roomType}`);
        room = await jsonMapperRepository.createRoomType(input.roomType);
        warnings.push(`Created new room type: "${input.roomType}"`);
      }
      roomTypeId = room.id;
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
      warnings,
    };
  },
};
