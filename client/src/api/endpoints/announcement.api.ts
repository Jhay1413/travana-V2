import type { HubAnnouncement } from "@shared/schema";
import axios from "../client/axios-client";

const BASE = "/api/announcements";

export const announcementApi = {
  async getAll(): Promise<HubAnnouncement[]> {
    const { data } = await axios.get(BASE);
    return data;
  },

  async create(input: { title?: string; content: string; category: string; pinned?: boolean }): Promise<HubAnnouncement> {
    const { data } = await axios.post(BASE, input);
    return data;
  },

  async update(id: string, input: { title?: string; content?: string; category?: string; pinned?: boolean }): Promise<HubAnnouncement> {
    const { data } = await axios.patch(`${BASE}/${id}`, input);
    return data;
  },

  async togglePin(id: string): Promise<HubAnnouncement> {
    const { data } = await axios.patch(`${BASE}/${id}/pin`);
    return data;
  },

  async remove(id: string): Promise<void> {
    await axios.delete(`${BASE}/${id}`);
  },

  async toggleLike(id: string): Promise<{ liked: boolean }> {
    const { data } = await axios.post(`${BASE}/${id}/like`);
    return data;
  },

  async getLikes(id: string): Promise<{ count: number; userLiked: boolean }> {
    const { data } = await axios.get(`${BASE}/${id}/likes`);
    return data;
  },

  async getBulkLikes(): Promise<Record<string, { count: number; userLiked: boolean }>> {
    const { data } = await axios.get(`${BASE}/likes/bulk`);
    return data;
  },

  async sharePost(id: string): Promise<void> {
    await axios.post(`${BASE}/${id}/share`);
  },
};
