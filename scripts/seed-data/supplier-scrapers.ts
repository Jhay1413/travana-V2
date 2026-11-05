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
    "supplierKey": "anextour",
    "supplierName": "Anextour",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "anextour.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "Total:\\s*£[\\d,]+"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Passengers:\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-26T13:27:41.441Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "1 adult"
          },
          "resort": {
            "from": "text",
            "group": 0,
            "regex": "Dubai",
            "fallback": "Dubai"
          },
          "country": {
            "from": "text",
            "group": 0,
            "regex": "United Arab Emirates",
            "fallback": "United Arab Emirates"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*infants",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*children",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Room:\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-26T13:27:41.445Z",
            "strategy": "label-anchored",
            "verifiedValue": "1x Standard Room Single Use"
          },
          "board_basis": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Board Basis:\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-26T13:27:41.444Z",
            "strategy": "label-anchored",
            "verifiedValue": "All Inclusive"
          },
          "destination": {
            "from": "url",
            "group": 1,
            "regex": "destination=([^&]+)"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "^([^\n]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Total Price\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-26T13:27:41.435Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£610.36"
          },
          "star_rating": {
            "from": "text",
            "group": 1,
            "regex": "([1-5])\\s*star",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "Outbound:\\s*([\\d]{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]+\\s+[\\d]{4})",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Duration:\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-26T13:27:41.439Z",
            "strategy": "label-anchored",
            "verifiedValue": "7 Nights"
          },
          "review_score": {
            "from": "text",
            "group": 1,
            "regex": "(\\d{2,3,} reviews)"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[^\\n]*?\\bDo[ \\t]+you[ \\t]+require\\b[^\\n]*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-26T13:27:41.443Z",
            "strategy": "label-anchored",
            "verifiedValue": "Sbh Hotel Taro Beach"
          },
          "transfer_type": {
            "map": {
              "shared transfer": "Shared Transfer",
              "shuttle service": "Shared Transfer",
              "private ground transfer": "Private Transfer"
            },
            "from": "text",
            "group": 1,
            "regex": "(private ground transfer|shared transfer|shuttle service)",
            "fallback": "None"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Total Price\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-26T13:27:41.435Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£610.36"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 0,
            "regex": "local taxes"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 0,
            "regex": "Dubai - International",
            "fallback": "Dubai - International"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Departure Airport\\s*\\n*([A-Za-z ]+)"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Anex Tour"
        },
        "packageType": "package-holiday",
        "luggageRegex": "(\\d+)\\s*x?\\s*(?:bag|luggage|hold bag|checked bag)s?",
        "flightModalTrigger": "flight details|compare airport",
        "flightsReturnSection": {
          "origin": "picked",
          "source": "text",
          "endLabel": "Flight Transfers (Roundtrip Shuttle Transfer (ESP))",
          "pickedAt": "2026-10-26T13:27:41.447Z",
          "blockLines": 8,
          "sampleText": "Inbound:\nEasyjet (EZY 5646)\n19:25\n13th Dec 2026\nFUE\n23:55\n13th Dec 2026\nNCL",
          "startLabel": "Inbound:"
        },
        "flightsOutboundSection": {
          "origin": "picked",
          "source": "text",
          "endLabel": "Inbound:",
          "pickedAt": "2026-10-26T13:27:41.447Z",
          "blockLines": 8,
          "sampleText": "Outbound:\nEasyjet (EZY 5645)\n14:20\n6th Dec 2026\nNCL\n18:45\n6th Dec 2026\nFUE",
          "startLabel": "Outbound:"
        }
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "carnival",
    "supplierName": "Carnival",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "carnival.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "\\$\\d{1,3}(,\\d{3})*(\\.\\d{2})?"
        },
        "fields": {
          "adults": {
            "from": "url",
            "group": 1,
            "regex": "numGuests=([^&]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:41:48.189Z",
            "strategy": "url-param",
            "transform": "number",
            "verifiedValue": "2"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "from [^,]+, ([A-Z]{2})"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "Ship:\\s*([^\n]+)"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "Room 1:\\s*([^\n]+)"
          },
          "cruise_date": {
            "from": "text",
            "group": 2,
            "regex": "(Fri|Mon|Tue|Wed|Thu|Sat|Sun)\\s+([A-Za-z]{3}\\s+\\d{2},\\s+\\d{4})",
            "transform": "date"
          },
          "cruise_line": {
            "from": "title",
            "group": 1,
            "regex": "^(Carnival)"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "from ([^,\\n]+),"
          },
          "quote_title": {
            "from": "headings",
            "group": 1,
            "regex": "^[^\\n]*\\n([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:41:48.189Z",
            "strategy": "heading-position",
            "verifiedValue": "3-Day The Bahamas from Miami, FL"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Total \\(USD\\):\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:41:48.189Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "$926.00"
          },
          "cabin_number": {
            "from": "text",
            "group": 1,
            "regex": "Room:\\s*(\\d+)"
          },
          "cruise_title": {
            "from": "headings",
            "group": 1,
            "regex": "^[^\\n]*\\n([^\\n]+)"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)-Day",
            "transform": "number"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "Rates are in US Dollars, average per person and based on double occupancy\\..*?\\$([\\d,]+\\.\\d{2})",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "USD",
          "tour_operator": "Carnival"
        },
        "packageType": "cruise",
        "luggageRegex": "",
        "itineraryRegex": "Day\\s*(\\d+)[^\\n]*\\n([^\n]+)",
        "flightModalTrigger": ""
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "celebritycruises",
    "supplierName": "Celebritycruises",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "celebritycruises.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\s?\\d{1,3}(,\\d{3})*(\\.\\d{2})?\\s?GBP"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Guests\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T10:57:04.572Z",
            "strategy": "label-anchored",
            "verifiedValue": "2 Adults"
          },
          "country": {
            "from": "url",
            "group": 1,
            "regex": "country=([A-Z]{3})"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s+Infants?",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s+Children?",
            "transform": "number"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "Onboard\\s*\\n?([A-Za-z ]+)"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "We choose your ([^\n]+)"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "Dates?\\s*\\n?([0-9]{1,2}\\s+[A-Za-z]{3,9}\\s+20\\d{2})",
            "transform": "date"
          },
          "cruise_line": {
            "from": "title",
            "group": 0,
            "regex": "Celebrity Cruises",
            "fallback": "Celebrity Cruises"
          },
          "cruise_only": {
            "from": "text",
            "group": 0,
            "regex": "Cruise-Only"
          },
          "debarkation": {
            "from": "text",
            "group": 2,
            "regex": "(\\d+)\\s*\\n([A-Za-z ,]+)\\s*\\nArrives At"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "Leaving from\\s*\\n?([A-Za-z ,]+)"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Sign In\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T10:57:04.573Z",
            "strategy": "label-anchored",
            "verifiedValue": "10 Night Italy & French Riviera"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Room Total\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T10:57:04.572Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£2,984.00"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "Dates?\\s*\\n?([0-9]{1,2}\\s+[A-Za-z]{3,9}\\s+20\\d{2})",
            "transform": "date"
          },
          "cabin_number": {
            "from": "text",
            "group": 1,
            "regex": "Room location\\s*\\n?([^\n]+)"
          },
          "cruise_title": {
            "from": "title",
            "group": 1,
            "regex": "^([\\d]+\\s+Night\\s+[^|]+)"
          },
          "no_of_nights": {
            "from": "title",
            "group": 1,
            "regex": "(\\d+)\\s+Night",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "We choose your ([^\n]+)"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "Guest Total\\s*\\n?£([\\d,]+\\.\\d{2})",
            "transform": "number"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 1,
            "regex": "Taxes and fees\\s*\\n?£([\\d,]+\\.\\d{2})",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Celebrity Cruises"
        },
        "packageType": "cruise",
        "luggageRegex": "",
        "itineraryRegex": "^(\\d+|Day\\s*\\d+)\\s*\\n([A-Za-z /()]+,? [A-Za-z]+|Cruising \\(Cruising\\)|Day At Sea)",
        "flightModalTrigger": ""
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "cruise118",
    "supplierName": "Cruise118",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "cruise118.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\d{2,4}\\s*pp"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "Prices based on (\\d+) people sharing",
            "transform": "number"
          },
          "ship_name": {
            "from": "text",
            "group": 0,
            "regex": "Ventura\\b"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "Select Cabins\\s*([A-Z ]+)[\\s\\S]*?WAS £\\d+pp From £\\d+PP"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "\\d+ nights? - (\\d{1,2} \\w+ \\d{4})",
            "transform": "date"
          },
          "cruise_line": {
            "from": "text",
            "group": 1,
            "regex": "What's Included with\\s*([A-Za-z& ]+)"
          },
          "cruise_only": {
            "from": "text",
            "group": 0,
            "regex": "CRUISE ONLY"
          },
          "debarkation": {
            "from": "text",
            "group": 1,
            "regex": "Day 8\\s*\\d{1,2} \\w+ \\d{4}\\s*([A-Za-z ]+)"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "Day 1\\s*\\d{1,2} \\w+ \\d{4}\\s*([A-Za-z ]+)"
          },
          "quote_title": {
            "from": "headings",
            "group": 1,
            "regex": "^([^\n]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "From\\s*£(\\d{2,4})\\s*PP",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "\\d+ nights? - (\\d{1,2} \\w+ \\d{4})",
            "transform": "date"
          },
          "cruise_title": {
            "from": "title",
            "group": 1,
            "regex": "^([^\n|]+)"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) nights?\\s*-\\s*\\d{1,2} \\w+ \\d{4}",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 0,
            "regex": "Ventura\\s*\\|\\s*Scandinavia|Ventura\\b"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "From\\s*£(\\d{2,4})\\s*PP",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "tour_operator": "Cruise118"
        },
        "packageType": "cruise",
        "luggageRegex": "(\\d+)\\s*x?\\s*(?:bag|case|luggage|suitcase)s?",
        "itineraryRegex": "Day\\s*(\\d+)\\s*\\d{1,2} \\w+ \\d{4}\\s*([A-Za-z ]+)",
        "imageUrlIncludes": "ventura"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "crystalski",
    "supplierName": "Crystalski",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "crystalski.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\s?\\d{2,}(?:\\.\\d{2})?"
        },
        "fields": {
          "adults": {
            "from": "url",
            "group": 1,
            "regex": "noOfAdults=(\\d+)",
            "jsonPath": "packageData.rooms[0].occupancy.adults",
            "transform": "number"
          },
          "resort": {
            "from": "text",
            "group": 1,
            "regex": "In ([A-Za-z]+), [A-Za-z]+",
            "jsonPath": "packageData.locationMap.RESORT"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "In [^,]+, ([A-Za-z]+)",
            "jsonPath": "packageData.locationMap.COUNTRY"
          },
          "infants": {
            "from": "url",
            "group": 1,
            "regex": "rmpc=[^|]*\\|[^|]*\\|[^|]*\\|([^|]*)\\|",
            "jsonPath": "packageData.rooms[0].occupancy.infant",
            "transform": "number"
          },
          "children": {
            "from": "url",
            "group": 1,
            "regex": "noOfChildren=(\\d+)",
            "jsonPath": "packageData.rooms[0].occupancy.children",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "YOUR ROOM\\n([^\n]+)",
            "jsonPath": "packageData.rooms[0].roomType"
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
            "regex": "YOUR BOARD BASIS\\s*([A-Za-z &+]+)",
            "jsonPath": "packageData.rooms[0].boardType"
          },
          "destination": {
            "from": "text",
            "group": 1,
            "regex": "In ([A-Za-z]+), [A-Za-z]+",
            "jsonPath": "packageData.locationMap.RESORT"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "^([^\n]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "Total Price £(\\d{2,}(?:\\.\\d{2})?)",
            "jsonPath": "price.totalParty",
            "transform": "number"
          },
          "star_rating": {
            "from": "text",
            "group": 1,
            "regex": "Official rating\\s*(\\d)",
            "jsonPath": "packageData.ratings.officialRating",
            "transform": "number"
          },
          "travel_date": {
            "from": "url",
            "group": 1,
            "regex": "when=(\\d{2}-\\d{2}-\\d{4})",
            "jsonPath": "packageData.accomStartDate",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "url",
            "group": 1,
            "regex": "duration=(\\d+)",
            "jsonPath": "packageData.duration",
            "transform": "number"
          },
          "review_score": {
            "from": "text",
            "group": 1,
            "regex": "(\\d\\.\\d)/5",
            "jsonPath": "packageData.ratings.tripAdvisorRating",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "^([^\n]+)",
            "jsonPath": "packageData.accommodation.name"
          },
          "transfer_type": {
            "map": {
              "Coach transfers included": "Shared Transfer"
            },
            "from": "text",
            "group": 0,
            "regex": "Coach transfers included",
            "fallback": "None"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "£\\s?(\\d{2,}(?:\\.\\d{2})?)pp",
            "jsonPath": "price.perPerson",
            "transform": "number"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 1,
            "regex": "Tourist tax payable locally.*?(\\d+(?:\\.\\d{2})?)",
            "transform": "number"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "\\(1 hour 30 minutes approx. from ([A-Za-z ]+) airport\\)",
            "jsonPath": "itinerary.outbounds[0].arrivalAirport"
          },
          "departure_airport_name": {
            "from": "url",
            "group": 1,
            "regex": "airports%5B%5D=([A-Z]{3})",
            "jsonPath": "itinerary.outbounds[0].departureAirport"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Crystal Ski"
        },
        "luggageRegex": "(\\d+)\\s*x\\s*([0-9]+kg|bag|hold bag|checked bag|cabin bag|hand luggage)",
        "flightModalTrigger": "compare airport|flight details"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "cunard",
    "supplierName": "Cunard",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "cunard.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\d{1,3}(,\\d{3})*(\\.\\d{2})?\\s*per person"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "based on (\\d+) guests?",
            "transform": "number"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "Departs:\\s*[^,\\n]+,\\s*([^|\\n]+?)\\s*\\|"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "\\d+\\s*Nights?\\s*\\([^)]*\\)\\s*\\n+\\s*([^\\n]+)"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "([A-Za-z ]+ Staterooms?)\\s*From£[\\d,]+per person"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "(\\d{1,2} [A-Za-z]{3} \\d{4}) - (\\d{1,2} [A-Za-z]{3} \\d{4})",
            "transform": "date"
          },
          "cruise_line": {
            "map": {
              "| Cunard": "Cunard"
            },
            "from": "title",
            "group": 0,
            "regex": "\\|\\s*Cunard\\s*$"
          },
          "debarkation": {
            "from": "text",
            "group": 1,
            "regex": "Arrives: ([^,\\n]+),"
          },
          "destination": {
            "from": "text",
            "group": 1,
            "regex": "Departs: [^,\\n]+, ([^|\\n]+) \\|"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "Departs: ([^,\\n]+),"
          },
          "quote_title": {
            "from": "title",
            "group": 1,
            "regex": "^([A-Za-z &]+?)\\s*\\|\\s*\\d+\\s*nights?"
          },
          "travel_date": {
            "from": "title",
            "group": 1,
            "regex": "\\|\\s*(\\d{1,2} [A-Za-z]{3} \\d{2})\\s*\\|",
            "transform": "date"
          },
          "cruise_title": {
            "from": "title",
            "group": 1,
            "regex": "^([A-Za-z &]+) \\| \\d+ nights?"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": ",\\s*(\\d+)\\s*Nights?\\s*\\(",
            "transform": "number"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "From£[\\d,]+per person\\s*£([\\d,]+)per person",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Cunard"
        },
        "luggageRegex": "",
        "itineraryRegex": "Day\\s*(\\d+(?:-\\d+)?)\\s*\\n([^\n]+)",
        "imageUrlIncludes": "",
        "flightModalTrigger": ""
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "disneyholidays",
    "supplierName": "Disneyholidays",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "disneyholidays.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£[\\d,.]+\\s*GBP"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*Adults?",
            "transform": "number"
          },
          "country": {
            "from": "text",
            "group": 0,
            "regex": "Disneyland Paris",
            "fallback": "France"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*Infant",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*Child",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "\\n([A-Za-z ]+ Room)\\n"
          },
          "board_basis": {
            "from": "text",
            "group": 1,
            "regex": "(All Inclusive Plus|All Inclusive|Half Board Plus|Half Board|Full Board Plus|Full Board|Bed and Breakfast|Self Catering|Room Only)"
          },
          "destination": {
            "from": "text",
            "group": 0,
            "regex": "Disneyland Paris",
            "fallback": "Disneyland Paris"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "^([^\n]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "Total price\\s*£([\\d,.]+)",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 2,
            "regex": "(Thu|Mon|Tue|Wed|Fri|Sat|Sun)\\s+(\\d{1,2}(st|nd|rd|th)?\\s+\\w+\\s+\\d{4})\\s*-",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "text",
            "group": 0,
            "regex": "(Thu|Mon|Tue|Wed|Fri|Sat|Sun)\\s+\\d{1,2}(st|nd|rd|th)?\\s+\\w+\\s+\\d{4}\\s*-\\s*(Thu|Mon|Tue|Wed|Fri|Sat|Sun)\\s+\\d{1,2}(st|nd|rd|th)?\\s+\\w+\\s+\\d{4}"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "Disney Hotel ([^\n]+)"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "Total price\\s*£([\\d,.]+)",
            "transform": "number"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Newcastle Airport \\(NCL\\) - \\d{2}:\\d{2} ([A-Za-z ]+ \\([A-Z]{3}\\))"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "\\((\\w{3})\\)\\s*-\\s*\\d{2}:\\d{2}\\s*Paris"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Disneyholidays"
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
            "regex": "ROOM\\s*\\d+\\s*\\n+(?:[ \\t]*(?:Hurry|Selected|Popular|Most popular|Best (?:seller|value|choice)|Recommended|Great value|Last (?:room|few)|Only \\d+|Limited|Sold out|Price drop)[^\\n]*\\n+|[ \\t]*[^\\n]*(?:!|\\b\\d+ (?:rooms? )?left\\b)[^\\n]*\\n+)*[ \\t]*([^\\n]+)",
            "joinAll": " + "
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
          "tour_operator": "Easyjet"
        },
        "luggageRegex": "(\\d+)\\s*x\\s*hold bags?",
        "imageUrlIncludes": "ejh-web-prod-images",
        "imageContainerIncludes": "hotel-main-view",
        "flightModalTrigger": "compare prices"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "haysitour",
    "supplierName": "Haysitour",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "haysitour.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\d{1,3}(,\\d{3})*\\.\\d{2}"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) Adults",
            "transform": "number"
          },
          "resort": {
            "from": "text",
            "group": 1,
            "regex": "Accommodation[\\s\\S]*?, ([A-Za-z ]+), \\d+ Adults"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "Accommodation[\\s\\S]*?, ([A-Za-z ]+), \\d+ Adults"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) Infants",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) Children",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "-\\s*([^-\\n]+)\\n"
          },
          "board_basis": {
            "from": "text",
            "group": 1,
            "regex": "(Room Only|Bed and Breakfast|Half Board Plus|Half Board|Full Board Plus|Full Board|All Inclusive Plus|All Inclusive|Self Catering)"
          },
          "destination": {
            "from": "text",
            "group": 1,
            "regex": "Accommodation[\\s\\S]*?, ([A-Za-z ]+), \\d+ Adults"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "TOTAL HOLIDAY COST\\s*£([\\d,]+\\.\\d{2})",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "Outbound: Depart [A-Z]{3} ([\\d]{1,2}[a-z]{2} [A-Za-z]{3} [\\d]{4})",
            "transform": "date"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "\\((\\d+) nights?\\)",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "Accommodation\\s*([\\w\\s'\\-]+),"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "£([\\d,]+\\.\\d{2})pp",
            "transform": "number"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "to ([A-Za-z ]+), Return"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Flights\\s*([A-Za-z ]+) to"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Haysitour"
        },
        "luggageRegex": "(\\d+) checked bag.*?included",
        "flightModalTrigger": "add flight|flight details"
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
            "regex": "(?:^|\\n)[^\\S\\n]*(?:[\\w'&.-]+[^\\S\\n]+){1,6}?(?<!\\bcar[^\\S\\n])(?:Park|Village|Resort|Retreat|Estate|Lodges)[^\\S\\n]+in[^\\S\\n]+[^,\\n]+,[^\\S\\n]*([^\\n,]+?)[^\\S\\n]*(?=\\n|$)"
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
            "regex": "(?:^|\\n)[^\\S\\n]*(?:[\\w'&.-]+[^\\S\\n]+){1,6}?(?<!\\bcar[^\\S\\n])(?:Park|Village|Resort|Retreat|Estate|Lodges)[^\\S\\n]+in[^\\S\\n]+([^,\\n]+),[^\\S\\n]*[^\\n,]+?[^\\S\\n]*(?=\\n|$)"
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
          "tour_operator": "Hoseasons"
        },
        "imageContainerIncludes": [
          "lodge-gallery|property-gallery|accommodation-gallery",
          {
            "match": "park-gallery|park-images",
            "max": 5
          }
        ]
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
            "regex": "(\\d+)[^\\S\\n]*Infants?\\b[^\\n]*?for[^\\S\\n]+\\d+[^\\S\\n]+nights?",
            "transform": "number"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)[^\\S\\n]*Child(?:ren)?\\b[^\\n]*?for[^\\S\\n]+\\d+[^\\S\\n]+nights?",
            "transform": "number"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "(?:Room\\s*1\\s*:[^\\n]*\\n+(?:\\s*(?:Your room|Sleeps|Select)[^\\n]*\\n+)*\\s*|\\(1\\)[^\\S\\n]+)([^\\n(]+?)[^\\S\\n]*(?:\\n|\\(|$)"
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
              "express": "Shared Transfer",
              "coach": "Shared Transfer",
              "shared": "Shared Transfer",
              "free": "Shared Transfer",
              "return": "Shared Transfer",
              "transfer included": "Shared Transfer",
              "transfers included": "Shared Transfer",
              "private": "Private Transfer"
            },
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)(?![^\\n]*(?:\\badd\\b|\\bupgrade|£|\\boptional\\b|\\bextra\\b|\\bbook\\b|\\bavailable\\b|\\bno\\b|\\bnot\\b|exclud|\\bwithout\\b))[^\\n]*?\\b((?:express|coach|shared|private)(?=\\s+transfers?\\b)|free(?=\\s+(?:return\\s+)?transfers?\\b)|return(?=\\s+transfers?\\b)|transfers?\\s+included)",
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
    "supplierKey": "mercuryholidays",
    "supplierName": "Mercuryholidays",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "mercuryholidays.co.uk",
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
            "regex": "(?:^|\\n)\\s*All Inclusive\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T10:25:51.976Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "2 Adults"
          },
          "resort": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "transform": "titleCase",
            "urlSegment": 4
          },
          "country": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "transform": "titleCase",
            "urlSegment": 2
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "Choose Room Type[\\s\\S]*?\\d+ nights from [0-9]{1,2}(?:st|nd|rd|th)? [A-Za-z]{3,9} [0-9]{4}Edit\\s*([A-Za-z ]+ \\([^)]+\\))"
          },
          "board_basis": {
            "map": {
              "AI": "All Inclusive",
              "BB": "Bed and Breakfast",
              "FB": "Full Board",
              "HB": "Half Board",
              "RO": "Room Only",
              "SC": "Self Catering",
              "AI+": "All Inclusive Plus",
              "FB+": "Full Board Plus",
              "HB+": "Half Board Plus"
            },
            "from": "url",
            "group": 1,
            "regex": "[?&]boardBasis=(AI|AI\\+|HB|HB\\+|FB|FB\\+|BB|SC|RO)"
          },
          "destination": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "transform": "titleCase",
            "urlSegment": 3
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Your Hotel\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T10:25:51.976Z",
            "strategy": "label-anchored",
            "verifiedValue": "Villa Park Sun Island"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Total\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T10:25:51.960Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£3,803.02"
          },
          "star_rating": {
            "from": "text",
            "group": 0,
            "regex": "five star"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[ \\t]*([^\\n]+?)[ \\t]*(?:\\n[ \\t]*)+Edit[ \\t]+Dates[ \\t]*(?=\\n|$)",
            "origin": "picked",
            "pickedAt": "2026-10-20T10:25:51.972Z",
            "strategy": "label-after",
            "verifiedValue": "8 nights from 25th May 2027"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[ \\t]*([^\\n]+?)[ \\t]*(?:\\n[ \\t]*)+Edit[ \\t]+Dates[ \\t]*(?=\\n|$)",
            "origin": "picked",
            "pickedAt": "2026-10-20T10:25:51.973Z",
            "strategy": "label-after",
            "verifiedValue": "8 nights from 25th May 2027"
          },
          "review_score": {
            "from": "text",
            "group": 1,
            "regex": "Tripadvisor Reviews\\s*([\\d.]+)\\s*Excellent",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Your Hotel\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T10:25:51.977Z",
            "strategy": "label-anchored",
            "verifiedValue": "Villa Park Sun Island"
          },
          "transfer_type": {
            "map": {
              "Transfers are Included": "Shared Transfer"
            },
            "from": "text",
            "group": 0,
            "regex": "Transfers are Included",
            "fallback": "None"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Per Person\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T10:25:51.969Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£1,901.51"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 0,
            "regex": "Maldives, Indian Ocean",
            "fallback": "Malé"
          },
          "departure_airport_name": {
            "from": "url",
            "group": 1,
            "regex": "[?&]from=([A-Z]{3})"
          }
        },
        "version": 1,
        "constants": {
          "tour_operator": "Mercury Holidays"
        },
        "packageType": "package-holiday",
        "flightsSection": {
          "origin": "picked",
          "source": "text",
          "endLabel": "Edit Flights",
          "pickedAt": "2026-10-20T10:25:51.999Z",
          "sampleText": "Your Flights",
          "startLabel": "Edit Rooms"
        }
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "msccruises",
    "supplierName": "Msccruises",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "msccruises.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\d+"
        },
        "fields": {
          "adults": {
            "from": "url",
            "group": 1,
            "regex": "occupancy1=(\\d+)%7C",
            "transform": "number"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "\\|\\s*([A-Za-z ]+)"
          },
          "infants": {
            "from": "url",
            "group": 1,
            "regex": "occupancy1=\\d+%7C\\d+%7C(\\d+)%7C",
            "transform": "number"
          },
          "children": {
            "from": "url",
            "group": 1,
            "regex": "occupancy1=\\d+%7C(\\d+)%7C",
            "transform": "number"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "on\\s+(MSC [A-Za-z]+)"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Cabin Type:\\s*\\n+\\s*([^\\n]+)"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "(\\d{1,2}\\s+\\w{3},\\s*\\d{4})",
            "transform": "date"
          },
          "cruise_line": {
            "from": "text",
            "group": 0,
            "regex": "MSC Cruises",
            "fallback": "MSC Cruises"
          },
          "cruise_only": {
            "map": {
              "true": "false",
              "false": "true"
            },
            "from": "url",
            "group": 1,
            "regex": "isFlightIncluded=(false|true)"
          },
          "debarkation": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Arrival:\\s*\\n+\\s*[^\\n]+\\n+\\s*[^|\\n]*\\|\\s*([^\\n]+)"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Departure:\\s*\\n+\\s*[^\\n]+\\n+\\s*[^|\\n]*\\|\\s*([^\\n]+)"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Upgrade Now\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-06T03:46:35.521Z",
            "strategy": "label-anchored",
            "verifiedValue": "7 nights | Spain, Portugal"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "Total price\\s*\\n+\\s*£\\s*([\\d,]+(?:\\.\\d{2})?)",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Departure:\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-06T03:46:35.520Z",
            "strategy": "label-anchored",
            "verifiedValue": "17, Jan 2027"
          },
          "cabin_number": {
            "from": "text",
            "group": 1,
            "regex": "\\bCabin\\s+(\\d{3,5})\\b"
          },
          "cruise_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Your cruise\\s*\\n+\\s*([^\\n]+)"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Duration:\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-06T03:46:35.521Z",
            "strategy": "label-anchored",
            "verifiedValue": "7 nights"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "Price per person from:\\s*£([\\d,]+)",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "MSC Cruises"
        },
        "packageType": "cruise",
        "luggageRegex": "",
        "flightModalTrigger": ""
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "ncl",
    "supplierName": "Ncl",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "ncl.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "\\$\\d{1,3}(,\\d{3})*(\\.\\d{2})?"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s+Guests?",
            "transform": "number"
          },
          "country": {
            "from": "text",
            "group": 0,
            "regex": "Italy",
            "fallback": "Italy"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "ON NORWEGIAN ([A-Z]+)"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "STATEROOM #\\d+\\s*([^\n]+)"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "(\\d{1,2} \\w{3} \\u2014 \\d{1,2} \\w{3} \\d{4})"
          },
          "cruise_line": {
            "from": "text",
            "group": 0,
            "regex": "Norwegian Cruise Line",
            "fallback": "Norwegian Cruise Line"
          },
          "debarkation": {
            "from": "text",
            "group": 1,
            "regex": "DAY 9\\s*([^\n]+)"
          },
          "embarkation": {
            "from": "text",
            "group": 0,
            "regex": "Rome \\(Civitavecchia\\), Italy"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "^([^\n]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Total Due\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:35:23.418Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "$2,617.40"
          },
          "cabin_number": {
            "from": "text",
            "group": 1,
            "regex": "STATEROOM #?(\\d+)"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)-DAY",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "STATEROOM #\\d+\\s*([^\n]+)"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "Family Inside\\s*\\$([\\d,]+)",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "USD",
          "tour_operator": "Norwegian Cruise Line"
        },
        "packageType": "cruise",
        "luggageRegex": "",
        "itineraryRegex": "DAY\\s*(\\d+)\\s*([^\n]+)",
        "flightModalTrigger": ""
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "pocruises",
    "supplierName": "Pocruises",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "pocruises.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\s?\\d{1,3}(,\\d{3})*(\\.\\d{2})?pp"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "Based On (\\d+) Guests?",
            "transform": "number"
          },
          "country": {
            "from": "text",
            "group": 2,
            "regex": "Location\\s*\\n?([A-Za-z ,\\-()\\/]+), ([A-Za-z]+) to"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "Sailing on\\s*([A-Za-z]+),"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "(Inside|Outside|Balcony|Suite) Based On"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "(\\d{1,2} \\w{3,9} \\d{4})\\s*-\\s*(\\d{1,2} \\w{3,9} \\d{4})",
            "transform": "date"
          },
          "cruise_line": {
            "from": "text",
            "group": 1,
            "regex": "About ([A-Za-z& ]+)"
          },
          "cruise_only": {
            "from": "text",
            "group": 1,
            "regex": "(Direct flights and transfers included)"
          },
          "debarkation": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Location\\s*\\n+\\s*[^\\n]+?\\s+to\\s+([^\\n]+)"
          },
          "destination": {
            "from": "text",
            "group": 1,
            "regex": "Location\\s*\\n?([A-Za-z ,\\-()\\/]+)\\sto"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Location\\s*\\n+\\s*([^\\n]+?)\\s+to\\s+"
          },
          "quote_title": {
            "from": "headings",
            "group": 1,
            "regex": "^([^\n]+)"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "(\\d{1,2} \\w{3,9} \\d{4})\\s*-\\s*\\d{1,2} \\w{3,9} \\d{4}",
            "transform": "date"
          },
          "cruise_title": {
            "from": "headings",
            "group": 1,
            "regex": "^([^\n]+)"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+) nights?",
            "transform": "number"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "£\\s?([\\d,]+)pp",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "P&O Cruises"
        },
        "packageType": "cruise",
        "itineraryRegex": "Day\\s*(\\d+(?:-\\d+)?)\\s*\\n?([A-Za-z ,()\\/\\-]+)",
        "imageUrlIncludes": "azura"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "rivieratravel",
    "supplierName": "Rivieratravel",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "rivieratravel.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£\\d{3,}\\s*pp"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "\\((\\d+) people sharing\\)",
            "transform": "number"
          },
          "resort": {
            "from": "text",
            "group": 1,
            "regex": "resort of ([A-Za-z ]+), beautifully surrounded"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Room type:\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T11:47:54.650Z",
            "strategy": "label-anchored",
            "verifiedValue": "Double"
          },
          "board_basis": {
            "map": {
              "Full Board": "Full Board",
              "Half Board": "Half Board",
              "Bed and Breakfast": "Bed and Breakfast"
            },
            "from": "text",
            "group": 1,
            "regex": "(All Inclusive Plus|All Inclusive|Half Board Plus|Half Board|Full Board Plus|Full Board|Bed and Breakfast|Self Catering|Room Only)"
          },
          "destination": {
            "from": "url",
            "group": 1,
            "regex": "([^/?#]+)",
            "transform": "titleCase",
            "urlSegment": 2
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Escorted Tour\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T11:47:54.648Z",
            "strategy": "label-anchored",
            "verifiedValue": "Lake Garda, Venice and Verona"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Total price:\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T11:47:54.643Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£2,678.00"
          },
          "star_rating": {
            "from": "text",
            "group": 1,
            "regex": "(\\d) stars",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Departing:\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T11:47:54.644Z",
            "strategy": "label-anchored",
            "transform": "date",
            "verifiedValue": "28 April 2027"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s+nights?\\b",
            "jsonPath": "@graph[1].itinerary.numberOfItems",
            "transform": "number"
          },
          "accommodation": {
            "from": "headings",
            "group": 1,
            "regex": "^[^\\n]*\\n[^\\n]*\\n([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-20T11:47:54.649Z",
            "strategy": "heading-position",
            "verifiedValue": "Antico Borgo 4*"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "from\\s*£([\\d,]+)\\s*pp",
            "jsonPath": "@graph[1].offers.price",
            "transform": "number"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Hotel location\\s*([A-Za-z ]+)"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Airport\\s*([A-Za-z ]+)\\s*Riva del Garda"
          }
        },
        "version": 1,
        "constants": {
          "tour_operator": "Riviera Travel"
        },
        "packageType": "package-holiday",
        "flightsReturnSection": {
          "origin": "picked",
          "source": "text",
          "endLabel": "Room type:",
          "pickedAt": "2026-10-20T11:47:54.657Z",
          "blockLines": 1,
          "sampleText": "19:15",
          "startLabel": "Inbound:"
        },
        "flightsOutboundSection": {
          "origin": "picked",
          "source": "text",
          "endLabel": "Inbound:",
          "pickedAt": "2026-10-20T11:47:54.654Z",
          "blockLines": 1,
          "sampleText": "15:20",
          "startLabel": "Outbound:"
        }
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
          "textMatches": "[£$€]\\s*[\\d,]+\\.\\d{2}"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Guests\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:31:51.185Z",
            "strategy": "label-anchored",
            "verifiedValue": "2 Adults"
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
          "currency": {
            "from": "url",
            "group": 1,
            "regex": "selectedCurrencyCode=([A-Z]{3})",
            "fallback": "GBP"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*On\\s?Board\\s*\\n+\\s*([^\\n]+)"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "We choose your ([A-Za-z ]+)"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Dates?\\s*\\n+\\s*(\\d{1,2} [A-Za-z]{3,9} \\d{4})",
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
          "destination": {
            "from": "url",
            "group": 1,
            "regex": "destinationCode=([A-Z]+)"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Leaving from\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:31:51.186Z",
            "strategy": "label-anchored",
            "verifiedValue": "Southampton, England"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Sign In\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:31:51.186Z",
            "strategy": "label-anchored",
            "verifiedValue": "7 Night Spain & Portugal Cruise"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "Trip total\\s*\\n*[£$€]?\\s*([\\d,]+\\.\\d{2})",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Dates\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:31:51.185Z",
            "strategy": "label-anchored",
            "transform": "date",
            "verifiedValue": "9 May 2027"
          },
          "cabin_number": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Room(?:\\s*(?:number|no\\.?))?\\s*:?\\s*\\n+\\s*(\\d{3,5})\\b"
          },
          "cruise_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Sign In\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:31:51.186Z",
            "strategy": "label-anchored",
            "verifiedValue": "7 Night Spain & Portugal Cruise"
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
            "regex": "(?:^|\\n)\\s*On\\s?Board\\s*\\n+\\s*([^\\n]+)"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "The price is per person.*?[£$€]?\\s*([\\d,]+\\.\\d{2})",
            "transform": "number"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 1,
            "regex": "Taxes and fees\\s*\\n*[£$€]?\\s*([\\d,]+\\.\\d{2})",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Royal Caribbean"
        },
        "packageType": "cruise",
        "itineraryRegex": "Day\\s*(\\d+)\\s*\\n*([A-Za-z\\s,&]+)",
        "imageUrlIncludes": "royalcaribbean"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "seascanner",
    "supplierName": "Seascanner",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "seascanner.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "Price per person"
        },
        "fields": {
          "adults": {
            "from": "url",
            "group": 1,
            "regex": "[?&]adults=(\\d+)",
            "transform": "number"
          },
          "infants": {
            "from": "url",
            "group": 1,
            "regex": "[?&]infants=(\\d+)",
            "transform": "number"
          },
          "children": {
            "from": "url",
            "group": 1,
            "regex": "[?&]children=(\\d+)",
            "transform": "number"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "Ship\\s*\\n?([^\n]+)"
          },
          "cabin_type": {
            "map": {
              "suite": "Suite",
              "inside": "Inside",
              "balcony": "Balcony",
              "oceanview": "Oceanview"
            },
            "from": "text",
            "group": 1,
            "regex": "Price per person / ([^\\n]+) stateroom"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "Date\\s*\\n?([0-9]{1,2} [A-Za-z]{3} [0-9]{4})",
            "transform": "date"
          },
          "cruise_line": {
            "from": "text",
            "group": 1,
            "regex": "Cruise line/Ship\\s*([A-Za-z &]+) \\(\\d+\\)"
          },
          "cruise_only": {
            "from": "text",
            "group": 0,
            "regex": "Type of travel\\s*\\n?Cruise only"
          },
          "debarkation": {
            "from": "text",
            "group": 1,
            "regex": "Arrival\\s*-\\s*([^\n,]+),?\\s*([^\n]+)?"
          },
          "destination": {
            "from": "text",
            "group": 1,
            "regex": "\\n([A-Za-z ]+)\\nDuration\\s*\\n?[0-9]+\\s*nights?"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "Departure\\s*-\\s*([^\n,]+),?\\s*([^\n]+)?"
          },
          "quote_title": {
            "from": "headings",
            "group": 1,
            "regex": "^([^\n]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "£([0-9,]+)\\s*\\nFrom\\s*£[0-9,]+",
            "transform": "number"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "Duration\\s*\\n?([0-9]+)\\s*nights?",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "Ship\\s*\\n?([^\n]+)"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "From\\s*£([0-9,]+)",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "tour_operator": "Seascanner"
        },
        "packageType": "cruise"
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
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Edit Search\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:55:35.381Z",
            "strategy": "label-anchored",
            "verifiedValue": "Guayarmina Princess Hotel - Adults Only"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*£1095\\.85pp\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:55:35.379Z",
            "strategy": "label-anchored",
            "verifiedValue": "Total Price £2191.70"
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
            "regex": "(?:^|\\n)\\s*Green & Fair Hotel\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-07T06:55:35.380Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£1095.85pp"
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
          "tour_operator": "TUI"
        },
        "packageType": "package-holiday",
        "imageJsonPaths": [
          "packageData.accommodation.imageUrls",
          "packageData.accommodation.imageUrl"
        ],
        "imageContainerIncludes": "hero-gallery|accommodation-gallery",
        "luggageRegex": "(\\d+)\\s*x?\\s*(?:bag|luggage|suitcase)s?",
        "flightModalTrigger": "compare airport|flight details"
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "usairtours",
    "supplierName": "Usairtours",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "usairtours.co.uk",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£1,088"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[ \\t]*(?=[^\\n]*\\b(?:children|child|kids?|chd|infants?|babies|baby|inf)\\b)[^\\n]*?\\b(\\d{1,2})[ \\t]*(?:adults?|adt)\\b",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.809Z",
            "strategy": "party-count",
            "transform": "number",
            "verifiedValue": "2 Adults + 2 Children (10, 8 years old)"
          },
          "resort": {
            "from": "text",
            "group": 1,
            "regex": "Hotel stay: Five nights at [^,]+ in ([^,\\n]+), [^,]+, United States of America"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "New York City, NY, ([^\\n,]+)"
          },
          "infants": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[ \\t]*(?=[^\\n]*\\b(?:adults?|adt|children|child|kids?|chd)\\b)[^\\n]*?\\b(\\d{1,2})[ \\t]*(?:infants?|babies|baby|inf)\\b",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.809Z",
            "strategy": "party-count",
            "transform": "number",
            "verifiedValue": "0"
          },
          "children": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[ \\t]*(?=[^\\n]*\\b(?:adults?|adt|infants?|babies|baby|inf)\\b)[^\\n]*?\\b(\\d{1,2})[ \\t]*(?:children|child|kids?|chd)\\b",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.809Z",
            "strategy": "party-count",
            "transform": "number",
            "verifiedValue": "2"
          },
          "room_type": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[ \\t]*([^\\n]+?)[ \\t]*(?:\\n[ \\t]*)+ROOM[ \\t]+ONLY[ \\t]*(?=\\n|$)",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.810Z",
            "strategy": "label-after",
            "verifiedValue": "Chelsea Quadruple room (2 full double beds) (child meal not included)"
          },
          "board_basis": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[^\\n]*?\\bmeal[ \\t]+not\\b[^\\n]*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.810Z",
            "strategy": "label-anchored",
            "verifiedValue": "ROOM ONLY"
          },
          "destination": {
            "from": "text",
            "group": 1,
            "regex": "Flight & Accommodation to ([^\\n]+)"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Edit\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-13T05:35:32.252Z",
            "strategy": "label-anchored",
            "verifiedValue": "New York City: Five Nights of Family Discovery"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*package price per person\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.807Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "(£3,242.80 Total price)"
          },
          "star_rating": {
            "from": "text",
            "group": 1,
            "regex": "Moxy NYC Times Square\\s*([\\d.]+)\\s*Very good",
            "transform": "number"
          },
          "travel_date": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[ \\t]*([^\\n]+?)[ \\t]*(?:\\n[ \\t]*)+Edit[ \\t]+search[ \\t]*(?=\\n|$)",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.808Z",
            "strategy": "label-after",
            "verifiedValue": "2 Apr 2027 - 8 Apr 2027"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Nights\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.808Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "5"
          },
          "review_score": {
            "from": "text",
            "group": 1,
            "regex": "Moxy NYC Times Square\\s*([\\d.]+)\\s*Very good",
            "transform": "number"
          },
          "accommodation": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)[ \\t]*([^\\n]+?)[ \\t]*(?:\\n[ \\t]*)+[^\\n]*?\\bShow[ \\t]+on[ \\t]+map\\b",
            "origin": "picked",
            "pickedAt": "2026-10-13T09:29:30.810Z",
            "strategy": "label-after",
            "verifiedValue": "Chelsea Hotel, Toronto"
          },
          "transfer_type": {
            "map": {
              "this transfer is not listed as included": "None"
            },
            "from": "text",
            "group": 0,
            "regex": "this transfer is not listed as included",
            "fallback": "None"
          },
          "price_per_person": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Price per person From\\s*\\n+\\s*(?:(?:was|save|saving|rrp|from|now|previously|discount)\\b[^\\n]*\\n+\\s*){0,2}([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-10-12T14:05:45.660Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£1,088"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 1,
            "regex": "Due at property \\(estimated\\)[^£]*£([\\d,.]+)",
            "transform": "number"
          },
          "arrival_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "John F Kennedy Intl \\((JFK)\\)"
          },
          "departure_airport_name": {
            "from": "text",
            "group": 1,
            "regex": "Heathrow London \\((LHR)\\)"
          }
        },
        "version": 1,
        "constants": {
          "tour_operator": "USAirtours"
        },
        "packageType": "package-holiday",
        "flightsReturnSection": {
          "origin": "picked",
          "source": "text",
          "endLabel": "YOUR COMMISSION",
          "pickedAt": "2026-10-13T09:29:30.812Z",
          "blockLines": 10,
          "sampleText": "Delta Air Lines - DL 5934\nDirect\n22:45\nLester B Pearson Intl (YYZ)\n7h 5m\n10:50\nHeathrow London (LHR)\n+1 day\nPACKAGE FARE (ITX)\nbag info",
          "startLabel": "Add more accommodation options to this quote"
        },
        "flightsOutboundSection": {
          "origin": "picked",
          "source": "text",
          "pickedAt": "2026-10-13T09:29:30.811Z",
          "blockLines": 9,
          "sampleText": "Delta Air Lines - DL 5935\nDirect\n17:25\nHeathrow London (LHR)\n7h 50m\n20:15\nLester B Pearson Intl (YYZ)\nPACKAGE FARE (ITX)\nbag info",
          "startLabel": "Transfers"
        }
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  },
  {
    "supplierKey": "virginvoyages",
    "supplierName": "Virginvoyages",
    "adapterType": "dom",
    "isActive": true,
    "config": {
      "auth": {
        "type": "none"
      },
      "deepLink": {
        "hostIncludes": "virginvoyages.com",
        "pathIncludes": ""
      },
      "extraction": {
        "wait": {
          "timeoutMs": 30000,
          "textMatches": "£[\\d,]+(\\.\\d{2})?"
        },
        "fields": {
          "adults": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s+sailors",
            "transform": "number"
          },
          "country": {
            "from": "text",
            "group": 1,
            "regex": "Round trip from [^,]+, ([^,\\n]+)"
          },
          "ship_name": {
            "from": "text",
            "group": 1,
            "regex": "\\d+\\s*NIGHTS\\s*\\n+\\s*(?:[•·|-]\\s*\\n+\\s*)?([^\\n]+)"
          },
          "cabin_type": {
            "from": "text",
            "group": 1,
            "regex": "Choose cabin\\s*\\n+\\s*([^\\n]+)"
          },
          "cruise_date": {
            "from": "text",
            "group": 1,
            "regex": "([A-Z][a-z]{2} \\d{1,2} - [A-Z][a-z]{2} \\d{1,2}, \\d{4})"
          },
          "cruise_line": {
            "from": "text",
            "fallback": "Virgin Voyages"
          },
          "embarkation": {
            "from": "text",
            "group": 1,
            "regex": "Round trip from ([^,\\n]+)"
          },
          "quote_title": {
            "from": "text",
            "group": 1,
            "regex": "\\d+\\s*NIGHTS\\s*\\n+\\s*(?:[•·|-]\\s*\\n+\\s*)?[^\\n]+\\n+\\s*([^\\n]+)"
          },
          "sales_price": {
            "from": "text",
            "group": 1,
            "regex": "(?:^|\\n)\\s*Grand total\\s*\\n+\\s*([^\\n]+)",
            "origin": "picked",
            "pickedAt": "2026-09-06T03:50:50.070Z",
            "strategy": "label-anchored",
            "transform": "number",
            "verifiedValue": "£2,013.10"
          },
          "cruise_title": {
            "from": "text",
            "group": 1,
            "regex": "\\d+\\s*NIGHTS\\s*\\n+\\s*(?:[•·|-]\\s*\\n+\\s*)?[^\\n]+\\n+\\s*([^\\n]+)"
          },
          "no_of_nights": {
            "from": "text",
            "group": 1,
            "regex": "(\\d+)\\s*NIGHTS",
            "transform": "number"
          },
          "tourist_tax_total": {
            "from": "text",
            "group": 1,
            "regex": "Prepay Service Charge\\s*£([\\d,]+(?:\\.\\d{2})?)",
            "transform": "number"
          }
        },
        "version": 1,
        "constants": {
          "currency": "GBP",
          "tour_operator": "Virgin Voyages"
        },
        "packageType": "cruise",
        "luggageRegex": "",
        "imageUrlIncludes": "",
        "flightModalTrigger": ""
      },
      "adapterType": "dom",
      "captureOnly": true,
      "specNeedsReview": true
    }
  }
] as unknown as SupplierScraperSeed[];
