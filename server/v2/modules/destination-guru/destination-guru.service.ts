import OpenAI from 'openai';
import { destinationGuruRepository } from './destination-guru.repository';
import { AppError } from '../../utils/error-handler';

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key is not configured');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const GURU_PROMPT = `You are a travel destination expert. Generate comprehensive destination intelligence for a UK-based travel agency. Return ONLY valid JSON (no markdown, no backticks) matching this exact structure:

{
  "destination": "<destination name>",
  "country": "<country name>",
  "heroEmoji": "<single relevant emoji>",
  "tagline": "<catchy 5-10 word tagline>",
  "bestTimeToVisit": { "months": "<e.g. May – October>", "reason": "<1-2 sentences>", "peakSeason": "<e.g. July & August>", "budgetSeason": "<e.g. May & October>" },
  "flightTimesFromUK": { "directHours": "<e.g. 3h 15m>", "airports": ["<UK airports>"], "airlines": ["<airlines>"], "tips": "<1-2 sentences>" },
  "travelInfo": { "currency": "<currency name and symbol>", "language": "<main language>", "timezone": "<timezone>", "visaRequired": "<visa info>", "waterSafety": "<tap water safety>", "plugType": "<plug type>", "summary": "<3-4 sentence overview>" },
  "temperatures": [{"month": "Jan", "avgHigh": 0, "avgLow": 0, "rainfall": 0}],
  "mustDo": [{"rank": 1, "name": "<name>", "category": "<category>", "shortDesc": "<desc>", "websiteUrl": "<url>", "price": "<price>", "openingHours": "<hours>", "tips": "<tip>", "bestFor": "<audience>", "duration": "<duration>", "address": "<address>"}]
}

Include exactly 10 items in mustDo. All temperatures in Celsius. All prices in GBP.`;

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

  async generate(destination: string, userId?: string) {
    const existing = await destinationGuruRepository.findByDestination(destination);
    if (existing) return existing;

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: GURU_PROMPT },
        { role: 'user', content: `Generate destination intelligence for: ${destination}` },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new AppError('Failed to generate destination data', 500);

    let parsed: any;
    try {
      parsed = JSON.parse(content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
    } catch {
      throw new AppError('Failed to parse AI response as JSON', 500);
    }

    if (!parsed.destination || !parsed.country || !parsed.bestTimeToVisit || !parsed.flightTimesFromUK || !parsed.travelInfo || !Array.isArray(parsed.temperatures) || parsed.temperatures.length !== 12 || !Array.isArray(parsed.mustDo) || parsed.mustDo.length === 0) {
      throw new AppError('AI response is missing required fields. Please try again.', 500);
    }

    return destinationGuruRepository.create({ destination: parsed.destination || destination, country: parsed.country || 'Unknown', data: parsed, createdBy: userId || null });
  },

  async remove(id: string) {
    return destinationGuruRepository.remove(id);
  },
};
