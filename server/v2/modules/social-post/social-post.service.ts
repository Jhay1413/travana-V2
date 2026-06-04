import OpenAI from "openai";
import { format } from "date-fns";
import { socialPostRepository } from "./social-post.repository";
import { AppError } from "../../utils/error-handler";
import {
  scheduleOnlySocialsPost,
  rescheduleOnlySocialsPost,
  deleteOnlySocialsPost,
  uploadMultipleOnlySocialsMedia,
  uploadOnlySocialsMedia,
  uploadMediaFromUrl,
  fetchOnlySocialsPost,
} from "../../utils/only-socials";
import type { TravelDeal } from "@shared/schema";
import type { OnlySocialsMediaUploadResponse, OnlySocialsMediaContent } from "./social-post.types";
import type { Scope } from "../../utils/scope";

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === "platform_admin") return null;
  return (scope as Scope).orgId || null;
}

// Cap on concurrent uploads to the external OnlySocials API. Kept modest so we
// parallelise without tripping their rate limits.
const MEDIA_UPLOAD_CONCURRENCY = 4;

/** Run async tasks with a bounded number in flight at once; results keep input order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

type MediaTask =
  | { kind: "file"; file: Express.Multer.File }
  | { kind: "url"; url: string };

/**
 * Upload new files and quote-image URLs to OnlySocials and return the full
 * ordered list of media ids (existing + uploaded). Files and URLs are uploaded
 * together through a single bounded-concurrency queue, so total time scales with
 * the slowest few uploads rather than the image count. File upload errors fail
 * the operation; URL fetch/upload errors are logged and skipped (best-effort).
 */
async function resolveMediaIds(
  existingImageIds: number[],
  newFiles: Express.Multer.File[],
  imageUrls: string[],
): Promise<number[]> {
  const tasks: MediaTask[] = [
    ...newFiles.map((file): MediaTask => ({ kind: "file", file })),
    ...imageUrls.map((url): MediaTask => ({ kind: "url", url })),
  ];

  console.log(
    `[SocialPost][timing] resolveMediaIds start: existing=${existingImageIds.length} files=${newFiles.length} urls=${imageUrls.length} concurrency=${MEDIA_UPLOAD_CONCURRENCY}`,
  );

  if (tasks.length === 0) {
    console.log("[SocialPost][timing] resolveMediaIds: nothing to upload (existing-only)");
    return [...existingImageIds];
  }

  const startedAt = Date.now();
  const uploaded = await mapWithConcurrency(tasks, MEDIA_UPLOAD_CONCURRENCY, async (task, index) => {
    const label = task.kind === "file" ? `file#${index} (${task.file.originalname})` : `url#${index} (${task.url})`;
    const taskStart = Date.now();
    if (task.kind === "file") {
      const result = await uploadOnlySocialsMedia(task.file);
      console.log(`[SocialPost][timing]   uploaded ${label} in ${Date.now() - taskStart}ms`);
      return Number(result.id);
    }
    try {
      const result = await uploadMediaFromUrl(task.url);
      console.log(`[SocialPost][timing]   uploaded ${label} in ${Date.now() - taskStart}ms`);
      return Number(result.id);
    } catch (err) {
      console.error(
        `[SocialPost][timing]   FAILED ${label} after ${Date.now() - taskStart}ms:`,
        err,
      );
      return null;
    }
  });

  const ok = uploaded.filter((id): id is number => id !== null).length;
  console.log(
    `[SocialPost][timing] resolveMediaIds done: ${ok}/${tasks.length} uploaded in ${Date.now() - startedAt}ms total`,
  );

  return [
    ...existingImageIds,
    ...uploaded.filter((id): id is number => id !== null),
  ];
}

async function assertQuoteInScope(quoteId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await socialPostRepository.quoteBelongsToOrg(quoteId, orgId);
  if (!ok) throw new AppError("Quote not found", 404);
}

async function assertDealInScope(dealId: string, scope: ScopeOrTrusted): Promise<TravelDeal> {
  const orgId = effectiveOrgId(scope);
  const deal = await socialPostRepository.findById(dealId);
  if (!deal) throw new AppError("Travel deal not found", 404);
  if (!orgId) return deal;
  const row = await socialPostRepository.findByIdWithOrg(dealId);
  if (!row || row.orgId !== orgId) {
    throw new AppError("Travel deal not found", 404);
  }
  return deal;
}

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
  travelDate: string | null;
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
📅 ${safeDateFormat(deal.travelDate)}<br>
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
      console.error(`[SocialPost] OpenAI call failed (${model}):`, err?.message ?? err);
      throw err;
    }
  }
  return "";
}

function safeDateFormat(dateStr: string | null | undefined): string {
  if (!dateStr) return "TBC";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "TBC";
    return format(d, "EEE dd MMM yyyy");
  } catch {
    return "TBC";
  }
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
  quoteType?: string;
  lodgeName?: string;
  parkName?: string;
  parkLocation?: string;
}

export const socialPostService = {
  async generatePost(params: GeneratePostParams, scope: ScopeOrTrusted): Promise<TravelDeal> {
    await assertQuoteInScope(params.quoteId, scope);

    if (await socialPostRepository.isTestTransactionForQuote(params.quoteId)) {
      throw new AppError("Cannot generate social post for a test transaction", 400);
    }

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
      quoteType,
      lodgeName,
      parkName,
      parkLocation,
    } = params;

    const safeTitle = title?.trim() || "Holiday Deal";
    const safeDestination = destination?.trim() || "Unknown";
    const safeNights = Number.isFinite(Number(nights)) && Number(nights) > 0 ? Number(nights) : 1;
    const safeTravelDate = travelDate || null;

    const isHotTub = quoteType === "hot_tub_break";
    const locationLabel = isHotTub
      ? [parkName, parkLocation].filter(Boolean).join(", ") || safeDestination
      : safeDestination;
    const propertyLabel = isHotTub
      ? [lodgeName, parkName].filter(Boolean).join(" at ") || safeTitle
      : safeTitle;

    const defaultResortSummary = isHotTub
      ? "🛁 Why You'll Love It:<br>🌿 Surrounded by peaceful countryside<br>🔥 Private hot tub included<br>🛏️ Comfortable lodge accommodation"
      : "🌞 Why You'll Love It:<br>🏖️ Great destination & atmosphere<br>🏨 Quality accommodation<br>🌴 Memorable holiday experience";
    const defaultHashtags = isHotTub
      ? ["#HotTubBreak", "#LodgeBreak", "#UKBreak", "#HolidayPark", "#WeekendGetaway", "#CoupleRetreat", "#HotTub", "#LodgeLife", "#TravelDeals", "#TinasTravelDeals"]
      : ["#TravelDeals", "#HolidayDeals", "#TravelAgency", "#BookNow", "#HolidayTime", "#TravelLife", "#Vacation", "#HolidayGoals", "#TinasTravelDeals", "#Travel"];

    const [subtitleResult, resortSummaryResult, hashtagsRawResult] = await Promise.allSettled([
      callOpenAI(
        isHotTub
          ? `Write a short, catchy subtitle (max 10 words) for a hot tub lodge break at "${propertyLabel}" in ${locationLabel}. Make it cosy and romantic. Return ONLY the subtitle text, no quotes.`
          : `Write a short, catchy travel subtitle (max 10 words) for a "${safeTitle}" deal to ${safeDestination}. Return ONLY the subtitle text, no quotes.`,
        "You are a travel copywriter who writes punchy, engaging holiday taglines.",
        30
      ),
      callOpenAI(
        isHotTub
          ? `Write a brief, engaging lodge summary in bullet form using relevant icons for "${propertyLabel}" in ${locationLabel}. Focus on the cosy atmosphere, hot tub experience, and countryside setting.

It should start with:
🛁 Why You'll Love It:
🌿 Surrounded by peaceful countryside

NOTE: Use HTML <br> tags between each line. Return ONLY the summary text.`
          : `Write a brief, engaging resort summary in bullet form using travel icons for "${safeTitle}" in ${safeDestination}. Focus on what makes this destination special, the atmosphere, and key amenities.

It should start with:
🌞 Why You'll Love It:
🏖️ Close to golden sands & turquoise waters

NOTE: Use HTML <br> tags between each line. Return ONLY the summary text.`,
        isHotTub
          ? "You are a travel expert who writes engaging UK lodge and holiday park descriptions."
          : "You are a travel expert who writes engaging resort and hotel descriptions.",
        200
      ),
      callOpenAI(
        isHotTub
          ? `Generate 10 relevant Facebook hashtags for a hot tub lodge break in ${locationLabel} (${safeNights} nights). Return ONLY the hashtags separated by spaces, e.g. #HotTubBreak #LodgeBreak`
          : `Generate 10 relevant Facebook hashtags for a travel deal to ${safeDestination} (${safeNights} nights). Return ONLY the hashtags separated by spaces, e.g. #TravelDeals #Tenerife`,
        "You are a social media expert for a travel agency.",
        80
      ),
    ]);

    if (subtitleResult.status === "rejected") console.error("[SocialPost] Subtitle generation failed:", subtitleResult.reason?.message);
    if (resortSummaryResult.status === "rejected") console.error("[SocialPost] Resort summary generation failed:", resortSummaryResult.reason?.message);
    if (hashtagsRawResult.status === "rejected") console.error("[SocialPost] Hashtag generation failed:", hashtagsRawResult.reason?.message);

    const subtitle = subtitleResult.status === "fulfilled" && subtitleResult.value ? subtitleResult.value : `${safeTitle} — Book Now`;
    const resortSummary = resortSummaryResult.status === "fulfilled" && resortSummaryResult.value ? resortSummaryResult.value : defaultResortSummary;
    const hashtagsRaw = hashtagsRawResult.status === "fulfilled" && hashtagsRawResult.value ? hashtagsRawResult.value : "";

    const parsedHashtags = hashtagsRaw.split(/\s+/).filter((h) => h.startsWith("#")).slice(0, 12);
    const hashtags = parsedHashtags.length > 0 ? parsedHashtags : defaultHashtags;

    const displayPrice = pricePerPerson || salesPrice || null;

    const deal: PostDeal = {
      title: safeTitle,
      travelDate: safeTravelDate,
      nights: safeNights,
      boardBasis: boardBasis || null,
      departureAirport: departureAirport || null,
      luggageTransfers: transferType && transferType !== "none" ? transferType : null,
      price: displayPrice,
    };

    const postHTML = formatPostHTML(deal, subtitle, resortSummary, hashtags);

    return await socialPostRepository.create({
      quote_id: quoteId,
      title: safeTitle,
      subtitle,
      post: postHTML,
      resortSummary,
      hashtags,
      travelDate: safeTravelDate,
      nights: safeNights,
      boardBasis: boardBasis || null,
      departureAirport: departureAirport || null,
      luggageTransfers: transferType && transferType !== "none" ? transferType : null,
      price: displayPrice,
    });
  },

  async getTravelDealByQuoteId(quoteId: string, scope: ScopeOrTrusted): Promise<TravelDeal | null> {
    await assertQuoteInScope(quoteId, scope);
    const deal = await socialPostRepository.findByQuoteId(quoteId);
    return deal ?? null;
  },

  async updateTravelDeal(id: string, data: Partial<TravelDeal>, scope: ScopeOrTrusted): Promise<TravelDeal> {
    await assertDealInScope(id, scope);
    return await socialPostRepository.update(id, data);
  },

  async schedulePost(
    id: string,
    postSchedule: string,
    postScheduleLocal: string,
    existingImageIds: number[],
    newFiles: Express.Multer.File[],
    imageUrls: string[] = [],
    scope: ScopeOrTrusted = { orgId: null }
  ): Promise<TravelDeal> {
    const t0 = Date.now();
    console.log(`[SocialPost][timing] schedulePost START id=${id}`);
    const deal = await assertDealInScope(id, scope);
    console.log(`[SocialPost][timing] assertDealInScope: ${Date.now() - t0}ms`);

    const tMedia = Date.now();
    const allImageIds = await resolveMediaIds(existingImageIds, newFiles, imageUrls);
    console.log(`[SocialPost][timing] media phase total: ${Date.now() - tMedia}ms (${allImageIds.length} ids)`);

    // OnlySocials stores the date/time verbatim (no timezone), so give it the
    // user's local wall-clock value; the DB keeps the absolute UTC instant.
    const tSchedule = Date.now();
    const result = await scheduleOnlySocialsPost(postScheduleLocal, deal.post, allImageIds);
    console.log(`[SocialPost][timing] scheduleOnlySocialsPost: ${Date.now() - tSchedule}ms`);

    const tDb = Date.now();
    const updated = await socialPostRepository.update(id, {
      onlySocialsId: result.uuid,
      postSchedule: new Date(postSchedule),
    });
    console.log(`[SocialPost][timing] db update: ${Date.now() - tDb}ms`);
    console.log(`[SocialPost][timing] schedulePost DONE id=${id} total=${Date.now() - t0}ms`);
    return updated;
  },

  async reschedulePost(
    id: string,
    newPostSchedule: string,
    newPostScheduleLocal: string,
    existingImageIds: number[],
    newFiles: Express.Multer.File[],
    postContent: string,
    imageUrls: string[] = [],
    scope: ScopeOrTrusted = { orgId: null }
  ): Promise<TravelDeal> {
    const t0 = Date.now();
    console.log(`[SocialPost][timing] reschedulePost START id=${id}`);
    const deal = await assertDealInScope(id, scope);
    if (!deal.onlySocialsId) throw new AppError("Post has not been scheduled on OnlySocials yet", 400);
    console.log(`[SocialPost][timing] assertDealInScope: ${Date.now() - t0}ms`);

    const tMedia = Date.now();
    const allImageIds = await resolveMediaIds(existingImageIds, newFiles, imageUrls);
    console.log(`[SocialPost][timing] media phase total: ${Date.now() - tMedia}ms (${allImageIds.length} ids)`);

    // OnlySocials gets the local wall-clock value; the DB keeps the UTC instant.
    const tSchedule = Date.now();
    const result = await rescheduleOnlySocialsPost(
      deal.onlySocialsId,
      newPostScheduleLocal,
      postContent,
      allImageIds
    );
    console.log(`[SocialPost][timing] rescheduleOnlySocialsPost: ${Date.now() - tSchedule}ms`);

    const tDb = Date.now();
    const updated = await socialPostRepository.update(id, {
      onlySocialsId: result.uuid,
      postSchedule: new Date(newPostSchedule),
    });
    console.log(`[SocialPost][timing] db update: ${Date.now() - tDb}ms`);
    console.log(`[SocialPost][timing] reschedulePost DONE id=${id} total=${Date.now() - t0}ms`);
    return updated;
  },

  async deleteScheduledPost(id: string, scope: ScopeOrTrusted): Promise<TravelDeal> {
    const deal = await assertDealInScope(id, scope);
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

  async getQuoteImages(quoteId: string, scope: ScopeOrTrusted): Promise<{ url: string; name: string; source: string; isPrimary: boolean }[]> {
    await assertQuoteInScope(quoteId, scope);
    let images: Array<{ url: string; name: string; source: string; isPrimary: boolean }> = [];
    try {
      images = await socialPostRepository.findAllImagesForQuote(quoteId);
    } catch (err) {
      console.error("[SocialPost] Error fetching quote images:", err);
    }
    return images.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  },

  async getPostMedia(id: string, scope: ScopeOrTrusted): Promise<{ media: OnlySocialsMediaContent[]; postContent: string }> {
    const deal = await assertDealInScope(id, scope);
    if (!deal.onlySocialsId) return { media: [], postContent: "" };
    const post = await fetchOnlySocialsPost(deal.onlySocialsId);
    const firstContent = post.versions?.[0]?.content?.[0];
    return {
      media: firstContent?.media ?? [],
      postContent: firstContent?.body ?? "",
    };
  },
};
