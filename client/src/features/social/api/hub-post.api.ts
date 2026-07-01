import axios from "@/api/client/axios-client";

const BASE = "/api/v2/hub-posts";

export interface HubPostData {
  id: string;
  authorId: string;
  authorName: string | null;
  type: string;
  content: string;
  image: string | null;
  badge: string | null;
  destination: string | null;
  value: string | null;
  pinned: boolean | null;
  likes: number;
  liked: boolean;
  createdAt: string;
  comments: { author: string; avatar: string; text: string; date: string }[];
}

export const hubPostApi = {
  async getAll(): Promise<HubPostData[]> {
    const { data } = await axios.get(BASE);
    return data;
  },

  async create(input: {
    type: string;
    content: string;
    image?: string | null;
    badge?: string | null;
    destination?: string | null;
    value?: string | null;
  }): Promise<HubPostData> {
    const { data } = await axios.post(BASE, input);
    return data;
  },

  async remove(id: string): Promise<void> {
    await axios.delete(`${BASE}/${id}`);
  },

  async hide(id: string): Promise<void> {
    await axios.post(`${BASE}/${id}/hide`);
  },

  async toggleLike(id: string): Promise<{ liked: boolean }> {
    const { data } = await axios.post(`${BASE}/${id}/like`);
    return data;
  },

  async addComment(id: string, text: string): Promise<{ author: string; avatar: string; text: string; date: string }> {
    const { data } = await axios.post(`${BASE}/${id}/comment`, { text });
    return data;
  },
};
