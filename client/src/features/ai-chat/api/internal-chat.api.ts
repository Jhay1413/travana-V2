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
  //
  // `files` (test-flow only): image attachment(s) sent with the message so a
  // tester can exercise the document-submission path (vision read → admin
  // route → ticket). With files the request goes up as multipart form-data
  // ("text" field + "attachments" files — axios sets the content type from
  // the FormData); without, the plain JSON body is unchanged.
  postMessage: async (sessionId: string, text: string, files?: File[]): Promise<PostMessageResult> => {
    try {
      let body: { text: string } | FormData = { text };
      let config: { headers: Record<string, string> } | undefined;
      if (files?.length) {
        const form = new FormData();
        form.append("text", text);
        for (const f of files) form.append("attachments", f, f.name);
        body = form;
        // Override the client's default application/json — axios replaces this
        // marker with the real multipart content type + boundary.
        config = { headers: { "Content-Type": "multipart/form-data" } };
      }
      const { data } = await axiosClient.post<ChatMessage>(`${BASE}/sessions/${sessionId}/messages`, body, config);
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
