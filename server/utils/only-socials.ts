import { format, parseISO } from "date-fns";
import { AppError } from "./error-handler";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import axios from "axios";
import type { OnlySocialsPost, OnlySocialsMediaUploadResponse } from "../types/social-post/social-post.types";

const ACCOUNT_ID = 44362;

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
  images: number[]
): Promise<{ id: string; uuid: string; name: string; hexColor: string }> => {
  const scheduleDateTime = parseISO(postSchedule);
  const scheduleDate = format(scheduleDateTime, "yyyy-MM-dd");
  const scheduleTime = format(scheduleDateTime, "HH:mm");
  const baseUrl = `${getApiBase()}/posts`;

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        accounts: [ACCOUNT_ID],
        versions: [
          {
            account_id: ACCOUNT_ID,
            is_original: true,
            content: [{ body: postContent, media: images, url: "" }],
            options: { facebook_page: { type: "post" } },
          },
        ],
        tags: [],
        date: scheduleDate,
        time: scheduleTime,
        status: "scheduled",
        until_date: null,
        until_time: "",
        repeat_frequency: null,
        short_link_provider: null,
        short_link_provider_id: null,
      }),
    });

    const data = (await response.json()) as { id: string; uuid: string; name: string; hexColor: string };

    if (!response.ok) {
      console.error("[OnlySocials] create post failed:", JSON.stringify(data));
      throw new AppError(`OnlySocials create error: ${JSON.stringify(data)}`, response.status);
    }

    console.log("[OnlySocials] post created:", data.id, data.uuid);

    const scheduled = await fetch(`${baseUrl}/schedule/${data.uuid}`, {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ postNow: false }),
    });

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
  images: number[]
): Promise<{ id: string; uuid: string; name: string; hexColor: string }> => {
  const scheduleDateTime = parseISO(newPostSchedule);
  const scheduleDate = format(scheduleDateTime, "yyyy-MM-dd");
  const scheduleTime = format(scheduleDateTime, "HH:mm");
  const url = `${getApiBase()}/posts/${onlySocialsPostId}`;

  const payload: Record<string, any> = {
    date: scheduleDate,
    time: scheduleTime,
  };

  if (images.length > 0) {
    payload.accounts = [ACCOUNT_ID];
    payload.versions = [
      {
        account_id: ACCOUNT_ID,
        is_original: true,
        content: [{ media: images, url: "" }],
        options: { facebook_page: { type: "post" } },
      },
    ];
  }

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      redirect: "follow",
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { id: string; uuid: string; name: string; hexColor: string };

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

export const uploadOnlySocialsMedia = async (
  file: Express.Multer.File | string,
  altText?: string
): Promise<OnlySocialsMediaUploadResponse> => {
  const fileName = typeof file === "string" ? path.basename(file) : file.originalname;

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

  try {
    const response = await axios.post(`${getApiBase()}/media`, formData, {
      headers: {
        ...getAuthHeader(),
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
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
  files: (Express.Multer.File | string)[]
): Promise<OnlySocialsMediaUploadResponse[]> => {
  return await Promise.all(files.map((file) => uploadOnlySocialsMedia(file)));
};
