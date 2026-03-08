import OpenAI from "openai";
import { destinationGuruRepository } from "../repositories/destination-guru.repository";
import type { DestinationGuru } from "@shared/schema";

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const GURU_PROMPT = `You are a travel destination expert. Generate comprehensive destination intelligence for a UK-based travel agency. Return ONLY valid JSON (no markdown, no backticks) matching this exact structure:

{
  "destination": "<destination name>",
  "country": "<country name>",
  "heroEmoji": "<single relevant emoji>",
  "tagline": "<catchy 5-10 word tagline>",
  "bestTimeToVisit": {
    "months": "<e.g. May – October>",
    "reason": "<1-2 sentences>",
    "peakSeason": "<e.g. July & August (busiest, hottest)>",
    "budgetSeason": "<e.g. May & October (fewer crowds, lower prices)>"
  },
  "flightTimesFromUK": {
    "directHours": "<e.g. 3h 15m>",
    "airports": ["<UK airports with direct flights>"],
    "airlines": ["<airlines operating routes>"],
    "tips": "<1-2 sentences about flight options>"
  },
  "travelInfo": {
    "currency": "<currency name and symbol>",
    "language": "<main language, note if English spoken>",
    "timezone": "<timezone abbreviation and UTC offset>",
    "visaRequired": "<visa info for UK passport holders>",
    "waterSafety": "<tap water safety info>",
    "plugType": "<plug type, note if UK adapter needed>",
    "summary": "<3-4 sentence area overview covering geography, culture, food, transport>"
  },
  "temperatures": [
    {"month": "Jan", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Feb", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Mar", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Apr", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "May", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Jun", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Jul", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Aug", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Sep", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Oct", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Nov", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>},
    {"month": "Dec", "avgHigh": <number>, "avgLow": <number>, "rainfall": <mm number>}
  ],
  "mustDo": [
    {
      "rank": 1,
      "name": "<activity name>",
      "category": "<one of: Sightseeing, Beach, Food & Drink, Adventure, Culture, Nature, Nightlife, Shopping, Wellness, Water Sports>",
      "shortDesc": "<1-2 sentence description>",
      "websiteUrl": "<real website URL if available>",
      "price": "<price range in GBP e.g. Free, £10-20pp, £50+pp>",
      "openingHours": "<typical hours e.g. 9am-6pm daily>",
      "tips": "<1 sentence insider tip>",
      "bestFor": "<e.g. Families, Couples, Adventure seekers>",
      "duration": "<e.g. 2-3 hours, Half day, Full day>",
      "address": "<rough location or address>"
    }
  ]
}

Include exactly 10 items in the mustDo array, ranked 1-10 by popularity/must-see importance.
All temperatures should be realistic averages in Celsius.
All prices should be in GBP (£).
Flight info should be specific to UK departure airports.`;

export const destinationGuruService = {
  async getAll(): Promise<DestinationGuru[]> {
    return destinationGuruRepository.findAll();
  },

  async getById(id: string): Promise<DestinationGuru | undefined> {
    return destinationGuruRepository.findById(id);
  },

  async getByDestination(destination: string): Promise<DestinationGuru | undefined> {
    return destinationGuruRepository.findByDestination(destination);
  },

  async generate(destination: string, userId?: string): Promise<DestinationGuru> {
    const existing = await destinationGuruRepository.findByDestination(destination);
    if (existing) {
      return existing;
    }

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: GURU_PROMPT },
        { role: "user", content: `Generate destination intelligence for: ${destination}` },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Failed to generate destination data");
    }

    let parsed: any;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    if (
      !parsed.destination ||
      !parsed.country ||
      !parsed.bestTimeToVisit ||
      !parsed.flightTimesFromUK ||
      !parsed.travelInfo ||
      !Array.isArray(parsed.temperatures) ||
      parsed.temperatures.length !== 12 ||
      !Array.isArray(parsed.mustDo) ||
      parsed.mustDo.length === 0
    ) {
      throw new Error("AI response is missing required fields. Please try again.");
    }

    return destinationGuruRepository.create({
      destination: parsed.destination || destination,
      country: parsed.country || "Unknown",
      data: parsed,
      createdBy: userId || null,
    });
  },

  async remove(id: string): Promise<void> {
    return destinationGuruRepository.remove(id);
  },
};
