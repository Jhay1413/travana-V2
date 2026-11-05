import { AppError } from "./error-handler";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import axios from "axios";
import type {
  OnlySocialsPost,
  OnlySocialsMediaUploadResponse,
  OnlySocialsAccount,
  OnlySocialsPublishTarget,
  SocialPlatform,
} from "../modules/social-post/social-post.types";
import type { SocialChannelInfo } from "../modules/social-settings/social-settings.types";

/** The one Facebook Page every agency used before accounts became selectable. Legacy fallback only. */
export const LEGACY_DEFAULT_ACCOUNT_ID = 81085;

/** Server flag: Instagram publishing is on only when SOCIAL_INSTAGRAM_ENABLED is exactly "true". */
export function isInstagramEnabled(): boolean {
  return process.env.SOCIAL_INSTAGRAM_ENABLED === "true";
}

/** True when both the workspace and API key are set, so OnlySocials can be called at all. */
export function isOnlySocialsConfigured(): boolean {
  return !!process.env.ONLY_SOCIALS_WORKSPACE && !!process.env.ONLYSOCIAL_API_KEY;
}

export function getOnlySocialsChannelInfo(): SocialChannelInfo {
  return {
    provider: "onlysocials",
    accountId: LEGACY_DEFAULT_ACCOUNT_ID,
    workspaceConfigured: !!process.env.ONLY_SOCIALS_WORKSPACE,
    apiKeyConfigured: !!process.env.ONLYSOCIAL_API_KEY,
    label: "Facebook Page via OnlySocials",
  };
}

function getApiBase(): string {
  const workspace = process.env.ONLY_SOCIALS_WORKSPACE;
  if (!workspace) throw new AppError("ONLY_SOCIALS_WORKSPACE is not set", 500);
  return `https://app.onlysocial.io/os/api/${workspace}`;
}

function getAuthHeader(): Record<string, string> {
  const token = process.env.ONLYSOCIAL_API_KEY;
  if (!token) throw new AppError("ONLYSOCIAL_API_KEY is not set", 500);
  return { Authorization: `Bearer ${token.trim()}` };
}

const UPLOAD_RETRY_ATTEMPTS = 3;
const UPLOAD_RETRY_BASE_DELAY_MS = 750;

// OnlySocials' /media endpoint intermittently answers 500 {"message":"Server
// Error"} under load; those uploads succeed on a retry. 4xx (except 429) are
// permanent and not worth repeating.
function isRetryableUploadError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 429 || status >= 500;
}

async function withUploadRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === UPLOAD_RETRY_ATTEMPTS || !isRetryableUploadError(error)) throw error;
      const delay = UPLOAD_RETRY_BASE_DELAY_MS * attempt;
      console.warn(`[OnlySocials] ${label}: attempt ${attempt}/${UPLOAD_RETRY_ATTEMPTS} failed, retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const ACCOUNTS_CACHE_TTL_MS = 5 * 60 * 1000;
let accountsCache: { at: number; accounts: OnlySocialsAccount[] } | null = null;

/** Test hook: forget the cached account list. */
export function clearOnlySocialsAccountsCache(): void {
  accountsCache = null;
}

/** Provider strings are unconfirmed, so match loosely: contains "instagram" / "facebook", else other. */
export function mapProviderToPlatform(provider: string | null | undefined): SocialPlatform {
  const p = (provider ?? "").toLowerCase();
  if (p.includes("instagram")) return "instagram";
  if (p.includes("facebook")) return "facebook";
  return "other";
}

interface RawOnlySocialsAccount {
  id?: number | string;
  uuid?: string;
  name?: string;
  username?: string | null;
  image?: string | null;
  provider?: string;
  authorized?: boolean;
}

/**
 * Every account connected to the shared OnlySocials workspace. Cached for ~5 minutes;
 * pass { force: true } before scheduling so a just-disconnected account is caught.
 */
export const listOnlySocialsAccounts = async (opts: { force?: boolean } = {}): Promise<OnlySocialsAccount[]> => {
  if (!opts.force && accountsCache && Date.now() - accountsCache.at < ACCOUNTS_CACHE_TTL_MS) {
    return accountsCache.accounts;
  }
  try {
    const response = await axios.get(`${getApiBase()}/accounts`, {
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      timeout: 15000,
    });
    const rows = (response.data as { data?: RawOnlySocialsAccount[] } | null)?.data;
    if (!Array.isArray(rows)) throw new Error("Unexpected accounts response");
    const accounts: OnlySocialsAccount[] = rows.map((row) => ({
      id: Number(row.id),
      uuid: row.uuid ?? "",
      name: row.name ?? row.username ?? `Account ${row.id}`,
      username: row.username ?? null,
      image: row.image ?? null,
      provider: row.provider ?? "",
      platform: mapProviderToPlatform(row.provider),
      authorized: row.authorized !== false,
    }));
    accountsCache = { at: Date.now(), accounts };
    return accounts;
  } catch (error) {
    console.error("[OnlySocials] list accounts failed:", error instanceof Error ? error.message : error);
    throw new AppError("Couldn't load connected accounts", 502);
  }
};

interface PostPayloadInput {
  targets: OnlySocialsPublishTarget[];
  postContent: string;
  images: number[];
  date: string;
  time: string;
}

/**
 * Body for POST /posts and PUT /posts/:id. One shared (original) version for every target.
 * Instagram options are undocumented, so an instagram options key is NEVER sent; the
 * facebook_page options are sent only when a Facebook account is among the targets.
 */
export function buildPostPayload({ targets, postContent, images, date, time }: PostPayloadInput) {
  if (targets.length === 0) throw new AppError("Choose at least one account to post to", 400);
  const options: Record<string, { type: string }> = {};
  if (targets.some((t) => t.platform === "facebook")) options.facebook_page = { type: "post" };
  return {
    accounts: targets.map((t) => t.accountId),
    versions: [
      {
        // TODO(owner Phase 0 check): the docs say account_id 0 = original version, but today's working
        // payload uses a real account id. Keep a real id (the first selected) until a real post confirms 0.
        account_id: targets[0].accountId,
        is_original: true,
        content: [{ body: postContent, media: images, url: "" }],
        options,
      },
    ],
    tags: [],
    date,
    time,
    until_date: null,
    until_time: "",
    repeat_frequency: null,
    short_link_provider: null,
    short_link_provider_id: null,
  };
}

export const deleteOnlySocialsPost = async (onlySocialsPostId: string): Promise<void> => {
  const url = `${getApiBase()}/posts/${onlySocialsPostId}`;
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const data = await response.json();
      throw new AppError(`OnlySocials delete error: ${JSON.stringify(data)}`, response.status);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to delete post on OnlySocials: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

export const fetchOnlySocialsPost = async (onlySocialsPostId: string): Promise<OnlySocialsPost> => {
  const url = `${getApiBase()}/posts/${onlySocialsPostId}`;
  try {
    const response = await axios.get(url, {
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
    });
    return response.data as OnlySocialsPost;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AppError(
        `Failed to fetch post from OnlySocials: ${JSON.stringify(error.response?.data) || error.message}`,
        error.response?.status ?? 500
      );
    }
    throw error;
  }
};

export const scheduleOnlySocialsPost = async (
  postSchedule: string,
  postContent: string,
  images: number[],
  targets: OnlySocialsPublishTarget[]
): Promise<{ id: string; uuid: string; name: string; hexColor: string }> => {
  // Split directly to avoid server-timezone conversion from parseISO + format.
  // postSchedule is the user's local datetime string e.g. "2026-04-15T14:30".
  const [scheduleDate, rawTime = "00:00"] = postSchedule.split("T");
  const scheduleTime = rawTime.substring(0, 5);
  const baseUrl = `${getApiBase()}/posts`;

  try {
    const tCreate = Date.now();
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        ...buildPostPayload({ targets, postContent, images, date: scheduleDate, time: scheduleTime }),
        status: "scheduled",
      }),
    });

    const data = (await response.json()) as { id: string; uuid: string; name: string; hexColor: string };
    console.log(`[OnlySocials][timing] create post POST /posts: ${Date.now() - tCreate}ms`);

    if (!response.ok) {
      console.error("[OnlySocials] create post failed:", JSON.stringify(data));
      throw new AppError(`OnlySocials create error: ${JSON.stringify(data)}`, response.status);
    }

    console.log("[OnlySocials] post created:", data.id, data.uuid);

    const tConfirm = Date.now();
    const scheduled = await fetch(`${baseUrl}/schedule/${data.uuid}`, {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ postNow: false }),
    });
    console.log(`[OnlySocials][timing] schedule confirm POST /posts/schedule: ${Date.now() - tConfirm}ms`);

    if (!scheduled.ok) {
      const schedData = await scheduled.json();
      console.error("[OnlySocials] schedule confirm failed:", JSON.stringify(schedData));
      throw new AppError(`OnlySocials schedule confirm error: ${JSON.stringify(schedData)}`, scheduled.status);
    }

    console.log("[OnlySocials] post scheduled successfully");

    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to schedule post on OnlySocials: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

export const rescheduleOnlySocialsPost = async (
  onlySocialsPostId: string,
  newPostSchedule: string,
  postContent: string,
  images: number[],
  targets: OnlySocialsPublishTarget[]
): Promise<{ id: string; uuid: string; name: string; hexColor: string }> => {
  const [scheduleDate, rawTime = "00:00"] = newPostSchedule.split("T");
  const scheduleTime = rawTime.substring(0, 5);
  const url = `${getApiBase()}/posts/${onlySocialsPostId}`;

  try {
    const tPut = Date.now();
    const response = await fetch(url, {
      method: "PUT",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      redirect: "follow",
      body: JSON.stringify(
        buildPostPayload({ targets, postContent, images, date: scheduleDate, time: scheduleTime })
      ),
    });

    const data = (await response.json()) as { id: string; uuid: string; name: string; hexColor: string };
    console.log(`[OnlySocials][timing] reschedule PUT /posts: ${Date.now() - tPut}ms`);

    if (!response.ok) {
      console.error("[OnlySocials] reschedule failed:", JSON.stringify(data));
      throw new AppError(`OnlySocials reschedule error: ${JSON.stringify(data)}`, response.status);
    }

    console.log("[OnlySocials] post rescheduled successfully:", data.id);

    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to reschedule post on OnlySocials: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
};

export const uploadMediaFromUrl = async (
  imageUrl: string,
  altText?: string
): Promise<OnlySocialsMediaUploadResponse> => {
  try {
    const tDownload = Date.now();
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: { "User-Agent": "AppleTravelCRM/1.0" },
    });

    const buffer = Buffer.from(response.data);
    const contentType = String(response.headers["content-type"] || "image/jpeg");
    console.log(
      `[OnlySocials][timing] download from URL (${Math.round(buffer.length / 1024)}KB): ${Date.now() - tDownload}ms — ${imageUrl}`,
    );

    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
    };
    const ext = extMap[contentType] || ".jpg";
    const urlPath = new URL(imageUrl).pathname;
    let fileName = path.basename(urlPath) || `image${ext}`;
    if (!/\.(jpe?g|png|gif|webp)$/i.test(fileName)) {
      fileName += ext;
    }

    const tUpload = Date.now();
    // Rebuild the FormData on every attempt — its stream is consumed by each send.
    const uploadResponse = await withUploadRetry(`upload from URL ${imageUrl}`, () => {
      const formData = new FormData();
      formData.append("file", buffer, {
        filename: fileName,
        contentType,
      });
      formData.append("alt_text", altText ?? fileName);
      return axios.post(`${getApiBase()}/media`, formData, {
        headers: {
          ...getAuthHeader(),
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    });
    console.log(`[OnlySocials][timing] upload to /media: ${Date.now() - tUpload}ms — ${imageUrl}`);

    console.log(`[OnlySocials] Uploaded image from URL: ${imageUrl} -> id: ${uploadResponse.data.id}`);
    return uploadResponse.data as OnlySocialsMediaUploadResponse;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AppError(
        `Failed to upload media from URL to OnlySocials: ${JSON.stringify(error.response?.data) || error.message}`,
        error.response?.status ?? 500
      );
    }
    throw error;
  }
};

export const uploadOnlySocialsMedia = async (
  file: Express.Multer.File | string,
  altText?: string
): Promise<OnlySocialsMediaUploadResponse> => {
  const fileName = typeof file === "string" ? path.basename(file) : file.originalname;

  try {
    const tUpload = Date.now();
    // Rebuild the FormData on every attempt — its stream is consumed by each send.
    const response = await withUploadRetry(`upload file ${fileName}`, () => {
      const formData = new FormData();
      if (typeof file === "string") {
        formData.append("file", fs.createReadStream(file), fileName);
      } else {
        formData.append("file", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      }
      formData.append("alt_text", altText ?? fileName);
      return axios.post(`${getApiBase()}/media`, formData, {
        headers: {
          ...getAuthHeader(),
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    });
    console.log(`[OnlySocials][timing] upload file to /media: ${Date.now() - tUpload}ms — ${fileName}`);
    return response.data as OnlySocialsMediaUploadResponse;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AppError(
        `Failed to upload media to OnlySocials: ${JSON.stringify(error.response?.data) || error.message}`,
        error.response?.status ?? 500
      );
    }
    throw error;
  }
};

export const uploadMultipleOnlySocialsMedia = async (
  files: (Express.Multer.File | string)[],
  batchSize = 2
): Promise<OnlySocialsMediaUploadResponse[]> => {
  const results: OnlySocialsMediaUploadResponse[] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((file) => uploadOnlySocialsMedia(file)));
    results.push(...batchResults);
  }
  return results;
};
