import type { HubAnnouncement } from "@shared/schema";
import axios from "@/api/client/axios-client";

const BASE = "/api/v2/announcements";

export const announcementApi = {
  async getAll(params?: { category?: string }): Promise<HubAnnouncement[]> {
    const { data } = await axios.get(BASE, { params });
    return data;
  },

  async create(input: { title?: string; content: string; category: string; pinned?: boolean; postToAll?: boolean; imageUrl?: string }): Promise<HubAnnouncement> {
    const { data } = await axios.post(BASE, input);
    return data;
  },

  async update(id: string, input: { title?: string; content?: string; category?: string; pinned?: boolean; postToAll?: boolean; imageUrl?: string }): Promise<HubAnnouncement> {
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

  async hide(id: string): Promise<void> {
    await axios.post(`${BASE}/${id}/hide`);
  },

  async getHidden(): Promise<string[]> {
    const { data } = await axios.get(`${BASE}/hidden`);
    return data;
  },

  async uploadImage(file: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append("image", file);
    const { data } = await axios.post(`${BASE}/upload-image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  async getMentionableUsers(): Promise<{ id: string; name: string; role: string }[]> {
    const { data } = await axios.get(`${BASE}/mentionable-users`);
    return data;
  },
};
