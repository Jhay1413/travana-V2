// Canonical supplier scraper configs, exported from a working database.
//
// A config describes how to READ a supplier portal — its deepLink pattern and
// its extraction spec — so it is platform-wide and identical everywhere. This
// file is the seed source; apply it with scripts/seed-supplier-scrapers.ts.
//
// Deliberately carries NO credentials. Trade-portal logins belong to a specific
// agency and must never travel in source control or across environments; the
// capture flow does not use them at all.
//
// Regenerate by dumping supplier_scraper (see the seeder header).
import type { ScraperConfig } from "../../server/v2/modules/scraper/scraper-engine.types";

export interface SupplierScraperSeed {
  supplierKey: string;
  supplierName: string;
  adapterType: string;
  isActive: boolean;
  config: ScraperConfig;
}

export const supplierScraperSeed: SupplierScraperSeed[] = [
  {
    "supplierKey": "agoda",
    "supplierName": "Agoda",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "agoda.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "₱\\s*[\\d,]+"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*adults?",
            "transform": "number"
          },
          "resort": {
            "from": "text",
            "group": 0,
            "regex": "Hong Kong Island West",
            "jsonPath": "address.addressLocality"
          },
          "country": {
            "from": "text",
            "group": 0,
            "regex": "Hong Kong SAR, China|Hong Kong",
            "jsonPath": "address.addressCountry"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*infants?",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*children?",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "Room photos and details\\s*([^\n]+)\\n\\d+ m²"
          },
          "board_basis": {
            "map": {
              "for 1": "Bed and Breakfast",
              "buffet": "Bed and Breakfast",
              "included": "Bed and Breakfast",
              "available": "Bed and Breakfast"
            },
            "from": "text",
            "group": 1,
            "regex": "Breakfast (available|for 1|included|buffet)?",
            "fallback": "Room Only"
          },
          "destination": {
            "from": "text",
            "group": 0,
            "regex": "Hong Kong",
            "jsonPath": "address.addressRegion"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "₱\\s*([\\d,]+)\\s*\\n*Per person",
            "transform": "number"
          },
          "star_rating": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+(?:\\.\\d+)?)\\s*stars?\\s*out of 5",
            "transform": "number"
          },
          "travel_date": {
            "from": "url",
            "group": 1,
            "regex": "[?&]checkIn=([0-9]{4}-[0-9]{2}-[0-9]{2})",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "url",
            "group": 1,
            "regex": "[?&]los=(\\d+)",
            "transform": "number"
          },
          "review_score": {
            "from": "text",
            "group": 1,
            "regex": "Property's review score\\s*(\\d+(?:\\.\\d+)?)\\s*out of\\s*10",
            "transform": "number"
          },
          "accommodation": {
            "from": "title",
            "group": 1,
            "regex": "^([^,|]+)",
            "jsonPath": "name"
          },
          "transfer_type": {
            "map": {
              "no transfer": "None",
              "shuttle service": "Shared Transfer",
              "airport transfer": "Shared Transfer"
            },
            "from": "text",
            "group": 1,
            "regex": "(airport transfer|shuttle service|no transfer)",
            "fallback": "None"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "₱\\s*([\\d,]+)\\s*\\n*Per person",
            "transform": "number"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Flight to Hong Kong[\\s\\S]+?\\d{2}:\\d{2}\\s*\\n*[A-Z]{3}[\\s\\S]+?\\d{2}:\\d{2}\\s*\\n*([A-Z]{3})"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Flight to Hong Kong[\\s\\S]+?\\d{2}:\\d{2}\\s*\\n*([A-Z]{3})"
          }
        },
        "version": 1,
        "constants": {
          "currency": "PHP",
          "tour_operator": "Agoda"
        }
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "easyjet",
    "supplierName": "Easyjet",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "easyjet.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\d{1,3}(,\\d{3})*(\\.\\d{2})?"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*adults?\\b",
            "transform": "number"
          },
          "resort": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "transform": "titleCase",
            "urlSegment": 5
          },
          "country": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "transform": "titleCase",
            "urlSegment": 3
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) infants?",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) children",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "ROOM\\s*\\d+\\s*\\n+\\s*(?:Hurry[^\\n]*\\n+\\s*)?([^\\n]+)"
          },
          "board_basis": {
            "map": {
              "Room Only": "Room Only",
              "Full Board": "Full Board",
              "Half Board": "Half Board",
              "All Inclusive": "All Inclusive",
              "Self Catering": "Self Catering",
              "Full Board Plus": "Full Board Plus",
              "Half Board Plus": "Half Board Plus",
              "Bed and Breakfast": "Bed and Breakfast",
              "All Inclusive Plus": "All Inclusive Plus"
            },
            "from": "text",
            "group": 1,
            "regex": "YOUR BOARD\\s*([A-Za-z &+]+)"
          },
          "destination": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "transform": "titleCase",
            "urlSegment": 4
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "£([\\d,]+)\\s*from\\s*£[\\d,]+\\s*pp",
            "transform": "number"
          },
          "star_rating": {
            "from": "text",
            "group": 1,
            "regex": "(\\d(?:\\.\\d)?)[- ]?star"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "(?:MAN|NCL)\\s*([A-Za-z]{3} \\d{1,2}(?:st|nd|rd|th)? [A-Za-z]{3} \\d{4})",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*nights?\\b",
            "transform": "number"
          },
          "review_score": {
            "from": "text",
            "group": 1,
            "regex": "(\\d\\.\\d)\\s*\\/\\s*10"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "\\n([^\\n]+)\\n\\d[\\d,]*\\s+reviews"
          },
          "transfer_type": {
            "map": {
              "Transfer included": "Shared Transfer"
            },
            "from": "text",
            "group": 0,
            "regex": "Transfer included",
            "fallback": "None"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "from\\s*£([\\d,]+)\\s*pp",
            "transform": "number"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 1,
            "regex": "\\+£([\\d,]+) taxes? & charges",
            "transform": "number"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "(Manchester|Newcastle)\\s*\\(MAN|NCL\\)"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Easyjet"
        },
        "luggageRegex": "(\\d+)\\s*x\\s*hold bags?",
        "imageUrlIncludes": "ejh-web-prod-images",
        "flightModalTrigger": "compare prices"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "hoseasons",
    "supplierName": "Hoseasons",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "hoseasons.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\s?\\d{2,4}"
        },
        "fields": {
          "pets": {
            "from": "text",
            "group": 1,
            "regex": "Pets\\s*(\\d+)",
            "transform": "number"
          },
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "Adults \\(18\\+\\)\\s*(\\d+)",
            "transform": "number"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "Seven Lakes Country Park in [^,]+, ([^\\n,]+)"
          },
          "hot_tub": {
            "from": "text",
            "group": 0,
            "regex": "hot tub"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "Babies \\(Under 2\\)\\s*(\\d+)",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "Children \\(2-17\\)\\s*(\\d+)",
            "transform": "number"
          },
          "cottage_id": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)$"
          },
          "lodge_type": {
            "from": "text",
            "group": 1,
            "regex": "Caravan features[\\s\\S]*?Accommodation Details[\\s\\S]*?About ([^\\n]+)"
          },
          "destination": {
            "from": "text",
            "group": 1,
            "regex": "Seven Lakes Country Park in ([^,\\n]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "PRICE NOW\\s*£\\s?(\\d{2,4})",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "(\\d{1,2}(?:st|nd|rd|th)?\\s+\\w+\\s+\\d{4})\\s*-",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "\\((\\d+) nights?\\)",
            "transform": "number"
          },
          "accommodation": {
            "from": "title",
            "group": 1,
            "regex": "^([^\\-]+)\\s-"
          },
          "lodge_park_name": {
            "from": "title",
            "group": 1,
            "regex": "-\\s([^\\-]+)\\s-\\sHoliday Parks"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Hoseasons"
        }
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "jet2holidays",
    "supplierName": "Jet2holidays",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "jet2holidays.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) Adults?",
            "jsonPath": "0.ecommerce.detail.products[0].dimension9",
            "transform": "number"
          },
          "resort": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "jsonPath": "0.ecommerce.detail.products[0].dimension3",
            "transform": "titleCase",
            "urlSegment": 3
          },
          "country": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "transform": "titleCase",
            "urlSegment": 1
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) Infants?",
            "jsonPath": "0.ecommerce.detail.products[0].dimension9",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) Children?",
            "jsonPath": "0.ecommerce.detail.products[0].dimension9",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "\\(1\\) ([\\w \\-/]+(room|suite|apartment|studio|villa))"
          },
          "board_basis": {
            "map": {
              "Room Only": "Room Only",
              "Full Board": "Full Board",
              "Half Board": "Half Board",
              "All Inclusive": "All Inclusive",
              "Self Catering": "Self Catering",
              "Full Board Plus": "Full Board Plus",
              "Half Board Plus": "Half Board Plus",
              "Bed and Breakfast": "Bed and Breakfast",
              "All Inclusive Plus": "All Inclusive Plus"
            },
            "from": "text",
            "group": 1,
            "regex": "(All Inclusive Plus|All Inclusive|Half Board Plus|Half Board|Full Board Plus|Full Board|Bed and Breakfast|Self Catering|Room Only)",
            "jsonPath": "0.ecommerce.detail.products[0].dimension17"
          },
          "destination": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "jsonPath": "0.ecommerce.detail.products[0].dimension2",
            "transform": "titleCase",
            "urlSegment": 2
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "Payable to Jet2holidays\\s*£([\\d,]+)",
            "jsonPath": "0.ecommerce.detail.products[0].price",
            "transform": "number"
          },
          "star_rating": {
            "from": "text",
            "group": 1,
            "regex": "Our rating\\s*([\\d.]+)",
            "jsonPath": "0.ecommerce.detail.products[0].dimension14",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "from (?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)?\\s*(\\d{2}[-/ ]\\w{3,9}[-/ ]\\d{4})",
            "jsonPath": "0.ecommerce.detail.products[0].dimension4",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) nights?",
            "jsonPath": "0.ecommerce.detail.products[0].dimension7",
            "transform": "number"
          },
          "review_score": {
            "from": "text",
            "group": 1,
            "regex": "([\\d.]+) based on \\d+ reviews",
            "jsonPath": "0.ecommerce.detail.products[0].dimension15",
            "transform": "number"
          },
          "accommodation": {
            "from": "title",
            "group": 1,
            "regex": "^([^-|]+)",
            "jsonPath": "0.ecommerce.detail.products[0].name"
          },
          "transfer_type": {
            "map": {
              "Shared transfer": "Shared Transfer",
              "coach transfers": "Shared Transfer",
              "Private transfer": "Private Transfer",
              "Express transfers": "Shared Transfer"
            },
            "from": "text",
            "group": 1,
            "regex": "(Express transfers|coach transfers|Private transfer|Shared transfer)",
            "fallback": "None"
          },
          "arrival_airport": {
            "from": "text",
            "jsonPath": "0.ecommerce.detail.products[0].destinationAirportCode"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "Price per person\\s*£([\\d,]+)",
            "transform": "number"
          },
          "departure_airport": {
            "from": "text",
            "jsonPath": "0.ecommerce.detail.products[0].departureAirportCode"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 1,
            "regex": "Approximately £([\\d,.]+) in tourist tax",
            "transform": "number"
          },
          "inbound_depart_time": {
            "from": "text",
            "jsonPath": "0.ecommerce.detail.products[0].dimension20"
          },
          "outbound_depart_time": {
            "from": "text",
            "jsonPath": "0.ecommerce.detail.products[0].dimension19"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Return flights ([A-Za-z ]+)",
            "jsonPath": "0.ecommerce.detail.products[0].dimension1"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Jet2holidays"
        },
        "luggageRegex": "(\\d+)kg ([\\w ]+)",
        "flightModalTrigger": "compare airport"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "royalcaribbean",
    "supplierName": "Royalcaribbean",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "royalcaribbean.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "\\$\\d+\\.\\d{2}\\s*USD"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "Guests?\\s*\\n*([0-9]+) Adults?",
            "transform": "number"
          },
          "country": {
            "from": "url",
            "group": 1,
            "regex": "country=([A-Z]{2,})"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "Guests?\\s*\\n*[0-9]+ Adults?\\s*\\n*[0-9]+ Children?\\s*\\n*([0-9]+) Infants?",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "Guests?\\s*\\n*[0-9]+ Adults?\\s*\\n*([0-9]+) Children?",
            "transform": "number"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "Onboard\\s*\\n*([A-Za-z\\s]+)"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "We choose your ([A-Za-z ]+)"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "Dates?\\s*\\n*([A-Za-z]{3,9} \\d{1,2}, \\d{4})",
            "transform": "date"
          },
          "cruise_line": {
            "from": "title",
            "group": 0,
            "regex": "Royal Caribbean",
            "fallback": "Royal Caribbean"
          },
          "cruise_only": {
            "from": "text",
            "group": 0,
            "regex": "cruise only"
          },
          "debarkation": {
            "from": "text",
            "group": 1,
            "regex": "Dates?\\s*\\n*[A-Za-z]{3,9} \\d{1,2}, \\d{4}\\s*\\n*([A-Za-z\\s,]+)"
          },
          "destination": {
            "from": "url",
            "group": 1,
            "regex": "destinationCode=([A-Z]+)"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "Leaving from\\s*\\n*([A-Za-z\\s,]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "Trip total\\s*\\n*\\$([\\d,]+\\.\\d{2})",
            "transform": "number"
          },
          "cabin_number": {
            "from": "text",
            "group": 0,
            "regex": "Room location\\s*\\n*To be assigned \\*"
          },
          "cruise_title": {
            "from": "title",
            "group": 1,
            "regex": "^(.*?)\\s*\\|"
          },
          "no_of_nights": {
            "from": "title",
            "group": 1,
            "regex": "(\\d+) Night",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "Onboard\\s*\\n*([A-Za-z\\s]+)"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "The price is per person.*?\\$([\\d,]+\\.\\d{2})",
            "transform": "number"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 1,
            "regex": "Taxes and fees\\s*\\n*\\$([\\d,]+\\.\\d{2})",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "USD",
          "tour_operator": "Royal Caribbean"
        },
        "itineraryRegex": "Day\\s*(\\d+)\\s*\\n*([A-Za-z\\s,&]+)",
        "imageUrlIncludes": "royalcaribbean"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "tui",
    "supplierName": "Tui",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "tui.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\d+[.,]?\\d*pp"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "Room1:(\\d+)Adults",
            "jsonPath": "packageData.accommodation.rooms[0].occupancy.adults",
            "transform": "number"
          },
          "resort": {
            "from": "text",
            "group": 1,
            "regex": "IN ([A-Z ]+?),",
            "jsonPath": "packageData.accommodation.locationMap.RESORT",
            "transform": "titleCase"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "IN (?:[A-Z ]+?,\\s*)?([A-Z ]+)",
            "jsonPath": "packageData.accommodation.locationMap.COUNTRY",
            "transform": "titleCase"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "Room1:[^\\n]*?(\\d+)Infants?",
            "fallback": 0,
            "jsonPath": "packageData.accommodation.rooms[0].occupancy.infant",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "Room1:\\d+Adults\\s*(\\d+)Children",
            "fallback": 0,
            "jsonPath": "packageData.accommodation.rooms[0].occupancy.children",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "\\n([^\\n]+)\\n+\\s*Sleeps:"
          },
          "board_basis": {
            "map": {
              "Bed & Breakfast": "Bed and Breakfast"
            },
            "from": "text",
            "group": 1,
            "regex": "(All Inclusive Plus|All Inclusive|Half Board Plus|Half Board|Full Board Plus|Full Board|Bed & Breakfast|Bed and Breakfast|Self Catering|Room Only)",
            "jsonPath": "packageData.accommodation.rooms[0].boardType"
          },
          "destination": {
            "from": "text",
            "group": 1,
            "regex": "IN ([A-Z ]+?),",
            "jsonPath": "packageData.accommodation.locationMap.DESTINATION",
            "transform": "titleCase"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "Total Price £([\\d,.]+)",
            "jsonPath": "price.totalPartyPriceForMC",
            "transform": "number"
          },
          "star_rating": {
            "from": "text",
            "group": 1,
            "regex": "Official rating\\s*(\\d)",
            "jsonPath": "packageData.accommodation.ratings.officialRating",
            "transform": "number"
          },
          "travel_date": {
            "from": "url",
            "group": 1,
            "regex": "[?&]when=(\\d{2}-\\d{2}-\\d{4})",
            "jsonPath": "packageData.accomStartDate",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "url",
            "group": 1,
            "regex": "[?&]duration=(\\d+)",
            "jsonPath": "packageData.accomEndDate",
            "transform": "number"
          },
          "review_score": {
            "from": "text",
            "group": 1,
            "regex": "(\\d\\.\\d)/5",
            "jsonPath": "packageData.accommodation.ratings.tripAdvisorRating",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "\\n([^\\n]+)\\n+\\s*IN [A-Z][A-Z ]*",
            "jsonPath": "packageData.accommodation.name"
          },
          "transfer_type": {
            "map": {
              "Transfers available": "Shared Transfer"
            },
            "from": "text",
            "group": 0,
            "regex": "Transfers available",
            "fallback": "None"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "£([\\d,.]+)pp",
            "jsonPath": "price.perPerson",
            "transform": "number"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 0,
            "regex": "extra hotel fees or tourist taxes, payable on check-in or check-out"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 0,
            "regex": "to your hotel, and back to the airport at the end of your stay",
            "fallback": "Prague",
            "jsonPath": "packageData.itinerary.outbounds[0].arrivalAirport"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "from ([A-Za-z ]+) Airport",
            "jsonPath": "packageData.itinerary.departureAirport"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "TUI"
        },
        "luggageRegex": "(\\d+)\\s*x?\\s*(?:bag|luggage|suitcase)s?",
        "flightModalTrigger": "compare airport|flight details"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  }
] as unknown as SupplierScraperSeed[];
