import axiosClient from "@/api/client/axios-client";
import { API_V2 } from "@/api/endpoints";
import type { ChatMessage, ChatMode, CreateSessionResponse, PostMessageResult } from "../types";

const BASE = `${API_V2}/internal-chat`;

// Shape of the error the axios response interceptor throws (see
// client/src/api/client/interceptors.ts): a plain Error decorated with
// `status` + `data` (the raw response body).
interface ChatApiError {
  status?: number;
  data?: { reply?: string };
}

function isTestFlowPendingError(err: unknown): err is ChatApiError & { data: { reply: string } } {
  if (!err || typeof err !== "object") return false;
  const e = err as ChatApiError;
  return e.status === 501 && typeof e.data?.reply === "string";
}

export const internalChatApi = {
  createSession: async (mode: ChatMode): Promise<CreateSessionResponse> => {
    const { data } = await axiosClient.post<CreateSessionResponse>(`${BASE}/sessions`, { mode });
    return data;
  },

  // The `test_flow` driver isn't wired up server-side yet: the controller
  // responds 501 `{ success: false, reply: "Test flow coming soon" }` instead
  // of the usual success envelope, so it rejects via the axios error path.
  // Normalize both outcomes into one PostMessageResult instead of throwing.
  postMessage: async (sessionId: string, text: string): Promise<PostMessageResult> => {
    try {
      const { data } = await axiosClient.post<ChatMessage>(`${BASE}/sessions/${sessionId}/messages`, { text });
      return { kind: "assistant_reply", message: data };
    } catch (err) {
      if (isTestFlowPendingError(err)) {
        return { kind: "test_flow_pending", reply: err.data.reply };
      }
      throw err;
    }
  },

  getMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    const { data } = await axiosClient.get<ChatMessage[]>(`${BASE}/sessions/${sessionId}/messages`);
    return data;
  },
};
