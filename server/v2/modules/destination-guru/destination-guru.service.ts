import { z } from 'zod';
import { destinationGuruRepository } from './destination-guru.repository';
import { AppError } from '../../utils/error-handler';
import { getOpenAI, UTILITY_MODEL } from '../../utils/ai-model';
import { usageService } from '../usage/usage.service';
import { coordinatesSchema } from './destination-guru.validator';

const GURU_PROMPT = `You are a travel destination expert. Generate comprehensive destination intelligence for a UK-based travel agency. Return ONLY a JSON object (no markdown, no backticks) matching this exact structure:

{
  "destination": "<destination name>",
  "country": "<country name>",
  "heroEmoji": "<single relevant emoji>",
  "tagline": "<catchy 5-10 word tagline>",
  "bestTimeToVisit": { "months": "<e.g. May – October>", "reason": "<1-2 sentences>", "peakSeason": "<e.g. July & August>", "budgetSeason": "<e.g. May & October>" },
  "flightTimesFromUK": { "directHours": "<e.g. 3h 15m>", "airports": ["<UK airports>"], "airlines": ["<airlines>"], "tips": "<1-2 sentences>" },
  "travelInfo": { "currency": "<currency name and symbol>", "language": "<main language>", "timezone": "<timezone>", "visaRequired": "<visa info>", "waterSafety": "<tap water safety>", "plugType": "<plug type>", "summary": "<3-4 sentence overview>" },
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
  "mustDo": [{"rank": 1, "name": "<name>", "category": "<category>", "shortDesc": "<desc>", "websiteUrl": "<url>", "price": "<price>", "openingHours": "<hours>", "tips": "<tip>", "bestFor": "<audience>", "duration": "<duration>", "address": "<address>"}],
  "coordinates": { "lat": <decimal degrees>, "lng": <decimal degrees> }
}

The "temperatures" array MUST contain exactly 12 entries, one per calendar month January through December, in order — never omit a month.
Include exactly 10 items in "mustDo", ranked 1-10 by popularity/must-see importance.
All temperatures in Celsius. All prices in GBP.
"coordinates" MUST be the WGS84 decimal-degree coordinates of the main town/resort centre (not the country centroid), with at least 4 decimal places. South and west are negative.`;

// Validation for the model's JSON so a malformed/incomplete response can't
// reach the repository or the client. Mirrors the shape the client
// (client/src/features/destination-guru/components/destination-guru.tsx)
// and the repository's jsonb `data` column expect.
const monthTemperatureSchema = z.object({
  month: z.string(),
  avgHigh: z.number(),
  avgLow: z.number(),
  rainfall: z.number(),
});

const mustDoItemSchema = z.object({
  rank: z.number(),
  name: z.string(),
  category: z.string(),
  shortDesc: z.string(),
  websiteUrl: z.string().optional(),
  price: z.string().optional(),
  openingHours: z.string().optional(),
  tips: z.string().optional(),
  bestFor: z.string().optional(),
  duration: z.string().optional(),
  address: z.string().optional(),
});

export const destinationGuruDataSchema = z.object({
  destination: z.string().min(1),
  country: z.string().min(1),
  heroEmoji: z.string(),
  tagline: z.string(),
  bestTimeToVisit: z.object({
    months: z.string(),
    reason: z.string(),
    peakSeason: z.string(),
    budgetSeason: z.string(),
  }),
  flightTimesFromUK: z.object({
    directHours: z.string(),
    airports: z.array(z.string()),
    airlines: z.array(z.string()),
    tips: z.string(),
  }),
  travelInfo: z.object({
    currency: z.string(),
    language: z.string(),
    timezone: z.string(),
    visaRequired: z.string(),
    waterSafety: z.string(),
    plugType: z.string(),
    summary: z.string(),
  }),
  // Exactly 12 rows — one per calendar month — mirrors the guard the
  // hand-rolled `parsed.temperatures.length !== 12` check used to enforce.
  temperatures: z.array(monthTemperatureSchema).length(12),
  mustDo: z.array(mustDoItemSchema).min(1),
});

export type DestinationGuruData = z.infer<typeof destinationGuruDataSchema>;

// Small, low-cost geocoding call used both as a fallback when the main
// generation's own "coordinates" field fails validation, and by the backfill
// script for rows created before coordinates existed. Never throws — a bad
// or unavailable geocode must never fail the caller; it returns null instead.
export async function geocodeDestination(
  destination: string,
  country: string,
  orgId?: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const model = UTILITY_MODEL;
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a geocoding assistant. Given a travel destination and its country, return ONLY a JSON object (no markdown, no backticks) matching this exact structure: {"lat": <decimal degrees>, "lng": <decimal degrees>}. The coordinates must be the WGS84 decimal-degree coordinates of the main town/resort centre (not the country centroid), with at least 4 decimal places. South and west are negative.',
        },
        { role: 'user', content: `Destination: ${destination}\nCountry: ${country}` },
      ],
      temperature: 0,
      max_tokens: 100,
    });

    if (orgId && response.usage) {
      void usageService.recordAiUsage({
        orgId,
        feature: 'destination_guru',
        model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens,
        },
      });
    }

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content.trim());
    } catch {
      return null;
    }

    const result = coordinatesSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export const destinationGuruService = {
  async getAll() {
    return destinationGuruRepository.findAll();
  },

  async getById(id: string) {
    return destinationGuruRepository.findById(id);
  },

  async getByDestination(destination: string) {
    return destinationGuruRepository.findByDestination(destination);
  },

  // `orgId` is server-derived (getScope(req).orgId) and only used for usage
  // metering — it never affects the generated content itself.
  async generate(destination: string, userId?: string, orgId?: string) {
    const existing = await destinationGuruRepository.findByDestination(destination);
    if (existing) {
      // Cheap self-healing, attempted at most once per row: a row that has
      // never had a geocode attempt (coordinatesSource NULL) gets one on
      // read. findByDestination is a fuzzy ILIKE match, so without the
      // coordinatesSource gate a destination that keeps failing to geocode
      // would re-bill an OpenAI call on every matching request — recording
      // 'failed' (lat/lng stay NULL) stops that. geocodeDestination itself
      // never throws (it swallows its own errors and returns null); this
      // catch only guards the repository writes below from failing the request.
      if (existing.latitude === null && existing.coordinatesSource === null) {
        try {
          const coords = await geocodeDestination(existing.destination, existing.country, orgId);
          if (coords) {
            const updated = await destinationGuruRepository.updateCoordinates(existing.id, {
              latitude: coords.lat,
              longitude: coords.lng,
              coordinatesSource: 'ai',
            });
            if (updated) return updated;
          } else {
            const marked = await destinationGuruRepository.markGeocodeFailed(existing.id);
            if (marked) return marked;
          }
        } catch {
          // best-effort only; fall through and return the existing row.
        }
      }
      return existing;
    }

    const model = 'gpt-4o';
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: GURU_PROMPT },
        { role: 'user', content: `Generate destination intelligence for: ${destination}` },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    if (orgId && response.usage) {
      void usageService.recordAiUsage({
        orgId,
        feature: 'destination_guru',
        model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens,
        },
      });
    }

    const content = response.choices[0]?.message?.content;
    if (!content) throw new AppError('Failed to generate destination data', 500);

    let parsed: unknown;
    try {
      // response_format: json_object guarantees valid JSON, but keep a
      // defensive trim in case of leading/trailing whitespace.
      parsed = JSON.parse(content.trim());
    } catch {
      throw new AppError('Failed to parse AI response as JSON', 500);
    }

    const result = destinationGuruDataSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError('AI response is missing required fields. Please try again.', 500);
    }

    // Coordinates are validated separately from the content shape — read
    // them from the raw parsed JSON (destinationGuruDataSchema doesn't
    // declare "coordinates", so result.data never carries it into the
    // jsonb `data` column). A bad or missing pair falls back to a dedicated
    // geocode call; if that also fails, the row is persisted with NULL
    // lat/lng and coordinatesSource 'failed' (rather than NULL) so the
    // existing-row self-heal above doesn't immediately re-attempt (and
    // re-bill) on the next fuzzy-matched request. It must never fail the
    // generation itself.
    const rawCoordinates = (parsed as { coordinates?: unknown } | null)?.coordinates;
    const coordsResult = coordinatesSchema.safeParse(rawCoordinates);

    let latitude: number | null = null;
    let longitude: number | null = null;
    let coordinatesSource: 'ai' | 'failed' = 'failed';

    if (coordsResult.success) {
      latitude = coordsResult.data.lat;
      longitude = coordsResult.data.lng;
      coordinatesSource = 'ai';
    } else {
      const fallback = await geocodeDestination(
        result.data.destination || destination,
        result.data.country || 'Unknown',
        orgId,
      );
      if (fallback) {
        latitude = fallback.lat;
        longitude = fallback.lng;
        coordinatesSource = 'ai';
      }
    }

    return destinationGuruRepository.create({
      destination: result.data.destination || destination,
      country: result.data.country || 'Unknown',
      data: result.data,
      createdBy: userId || null,
      latitude,
      longitude,
      coordinatesSource,
    });
  },

  async updateCoordinates(id: string, latitude: number, longitude: number) {
    const updated = await destinationGuruRepository.updateCoordinates(id, {
      latitude,
      longitude,
      coordinatesSource: 'manual',
    });
    if (!updated) throw new AppError('Destination not found', 404);
    return updated;
  },

  async remove(id: string) {
    return destinationGuruRepository.remove(id);
  },
};
