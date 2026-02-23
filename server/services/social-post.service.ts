import OpenAI from "openai";
import { format } from "date-fns";
import { socialPostRepository } from "../repositories/social-post.repository";
import { AppError } from "../utils/error-handler";
import {
  scheduleOnlySocialsPost,
  rescheduleOnlySocialsPost,
  deleteOnlySocialsPost,
  uploadMultipleOnlySocialsMedia,
  fetchOnlySocialsPost,
} from "../utils/only-socials";
import type { TravelDeal } from "@shared/schema";
import type { OnlySocialsMediaUploadResponse, OnlySocialsMediaContent } from "../types/social-post/social-post.types";

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError("OpenAI API key is not configured", 500);
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const EMOJI_POOLS = {
  tropical: ["🌴", "🌊", "☀️", "🏖️", "🌺"],
  subtitle: ["✨", "🌟", "💫", "⭐", "🎉"],
};

function pickRandomEmoji(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

interface PostDeal {
  title: string;
  travelDate: string;
  nights: number;
  boardBasis?: string | null;
  departureAirport?: string | null;
  luggageTransfers?: string | null;
  price?: string | null;
}

function formatPostHTML(
  deal: PostDeal,
  subtitle: string,
  resortSummary: string,
  hashtags: string[]
): string {
  const tropicalEmoji = pickRandomEmoji(EMOJI_POOLS.tropical);
  const subtitleEmoji = pickRandomEmoji(EMOJI_POOLS.subtitle);

  const priceSection = deal.price ? `💸 Total cost from £${deal.price}pp<br>` : "";
  const hashtagLine = hashtags.join(" ");

  return `${tropicalEmoji} ${deal.title} ${tropicalEmoji}<br>
${subtitleEmoji} ${subtitle} ${subtitleEmoji}<br>
<br>
📅 ${format(new Date(deal.travelDate), "EEE dd MMM yyyy")}<br>
🌙 ${deal.nights} Nights<br>
${deal.boardBasis && deal.boardBasis !== "N/A" ? `🍽️ ${deal.boardBasis}<br>` : ""}
${deal.departureAirport && deal.departureAirport !== "N/A" ? `✈️ ${deal.departureAirport}<br>` : ""}
${deal.luggageTransfers && deal.luggageTransfers !== "N/A" ? `🧳 ${deal.luggageTransfers} 🚌<br>` : ""}
<br>
${priceSection}<br>
${resortSummary}<br>
<br>To Book:<br>
☎ Call us on 0191 594 7999<br>
💬 Private message<br>
📍 Pop in and see us<br>
🌐 Visit our website: tinastraveldeals.co.uk<br>
📸 Follow us on Instagram: https://www.instagram.com/tinastravel/<br>
<br>
${hashtagLine}`;
}

async function callOpenAI(prompt: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const models = ["gpt-4o-mini", "gpt-3.5-turbo"];
  for (const model of models) {
    try {
      const response = await getOpenAI().chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
      });
      return response.choices[0]?.message?.content?.trim() ?? "";
    } catch (err: any) {
      if (err?.status === 404 && model !== models[models.length - 1]) continue;
      throw err;
    }
  }
  return "";
}

export interface GeneratePostParams {
  quoteId: string;
  title: string;
  destination: string;
  nights: number;
  boardBasis?: string;
  departureAirport?: string;
  transferType?: string;
  salesPrice?: string;
  pricePerPerson?: string;
  travelDate: string;
}

export const socialPostService = {
  async generatePost(params: GeneratePostParams): Promise<TravelDeal> {
    const {
      quoteId,
      title,
      destination,
      nights,
      boardBasis,
      departureAirport,
      transferType,
      salesPrice,
      pricePerPerson,
      travelDate,
    } = params;

    const [subtitle, resortSummary, hashtagsRaw] = await Promise.all([
      callOpenAI(
        `Write a short, catchy travel subtitle (max 10 words) for a "${title}" deal to ${destination}. Return ONLY the subtitle text, no quotes.`,
        "You are a travel copywriter who writes punchy, engaging holiday taglines.",
        30
      ),
      callOpenAI(
        `Write a brief, engaging resort summary in bullet form using travel icons for "${title}" in ${destination}. Focus on what makes this destination special, the atmosphere, and key amenities.

It should start with:
🌞 Why You'll Love It:
🏖️ Close to golden sands & turquoise waters

NOTE: Use HTML <br> tags between each line. Return ONLY the summary text.`,
        "You are a travel expert who writes engaging resort and hotel descriptions.",
        200
      ),
      callOpenAI(
        `Generate 10 relevant Facebook hashtags for a travel deal to ${destination} (${nights} nights). Return ONLY the hashtags separated by spaces, e.g. #TravelDeals #Tenerife`,
        "You are a social media expert for a travel agency.",
        80
      ),
    ]);

    const hashtags = hashtagsRaw
      .split(/\s+/)
      .filter((h) => h.startsWith("#"))
      .slice(0, 12);

    const displayPrice = pricePerPerson || salesPrice || null;

    const deal: PostDeal = {
      title,
      travelDate,
      nights,
      boardBasis: boardBasis || null,
      departureAirport: departureAirport || null,
      luggageTransfers: transferType && transferType !== "none" ? transferType : null,
      price: displayPrice,
    };

    const postHTML = formatPostHTML(deal, subtitle, resortSummary, hashtags);

    return await socialPostRepository.create({
      quote_id: quoteId,
      title,
      subtitle,
      post: postHTML,
      resortSummary,
      hashtags,
      travelDate,
      nights,
      boardBasis: boardBasis || null,
      departureAirport: departureAirport || null,
      luggageTransfers: transferType && transferType !== "none" ? transferType : null,
      price: displayPrice,
    });
  },

  async getTravelDealByQuoteId(quoteId: string): Promise<TravelDeal | null> {
    const deal = await socialPostRepository.findByQuoteId(quoteId);
    return deal ?? null;
  },

  async updateTravelDeal(id: string, data: Partial<TravelDeal>): Promise<TravelDeal> {
    const existing = await socialPostRepository.findById(id);
    if (!existing) throw new AppError("Travel deal not found", 404);
    return await socialPostRepository.update(id, data);
  },

  async schedulePost(id: string, postSchedule: string, images: number[]): Promise<TravelDeal> {
    const deal = await socialPostRepository.findById(id);
    if (!deal) throw new AppError("Travel deal not found", 404);

    const result = await scheduleOnlySocialsPost(postSchedule, deal.post, images);

    return await socialPostRepository.update(id, {
      onlySocialsId: result.uuid,
      postSchedule: new Date(postSchedule),
    });
  },

  async reschedulePost(id: string, newPostSchedule: string, images: number[] = []): Promise<TravelDeal> {
    const deal = await socialPostRepository.findById(id);
    if (!deal) throw new AppError("Travel deal not found", 404);
    if (!deal.onlySocialsId) throw new AppError("Post has not been scheduled on OnlySocials yet", 400);

    const result = await rescheduleOnlySocialsPost(
      deal.onlySocialsId,
      newPostSchedule,
      images
    );

    return await socialPostRepository.update(id, {
      onlySocialsId: result.uuid,
      postSchedule: new Date(newPostSchedule),
    });
  },

  async deleteScheduledPost(id: string): Promise<TravelDeal> {
    const deal = await socialPostRepository.findById(id);
    if (!deal) throw new AppError("Travel deal not found", 404);
    if (!deal.onlySocialsId) throw new AppError("Post has not been scheduled on OnlySocials", 400);

    await deleteOnlySocialsPost(deal.onlySocialsId);

    return await socialPostRepository.update(id, {
      onlySocialsId: null,
      postSchedule: null,
    });
  },

  async uploadMedia(files: Express.Multer.File[]): Promise<OnlySocialsMediaUploadResponse[]> {
    if (!files || files.length === 0) throw new AppError("No files provided", 400);
    return await uploadMultipleOnlySocialsMedia(files);
  },

  async getPostMedia(id: string): Promise<OnlySocialsMediaContent[]> {
    const deal = await socialPostRepository.findById(id);
    if (!deal) throw new AppError("Travel deal not found", 404);
    if (!deal.onlySocialsId) return [];
    const post = await fetchOnlySocialsPost(deal.onlySocialsId);
    return post.versions?.[0]?.content?.[0]?.media ?? [];
  },
};
