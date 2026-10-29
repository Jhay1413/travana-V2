import { blockedModeNote } from "./whatsapp-window";

export interface UpdateErrorInfo {
  title: string;
  description: string;
}

// The axios interceptor rejects with an Error carrying { status, code, data };
// a raw axios error (`response`) is kept as a fallback.
interface ErrorLike {
  status?: number;
  code?: string;
  response?: { status?: number; data?: { code?: string; message?: string } };
  message?: string;
}

function statusOf(e: ErrorLike): number | undefined {
  return e.status ?? e.response?.status;
}

function codeOf(e: ErrorLike): string | undefined {
  return e.code ?? e.response?.data?.code;
}

/** Maps a failed update send to the toast copy. The server message is already agent-readable. */
export function describeUpdateError(err: unknown, firstName: string): UpdateErrorInfo {
  const e = (err ?? {}) as ErrorLike;
  const status = statusOf(e);
  const code = codeOf(e);
  const message = e.response?.data?.message ?? e.message ??"Unknown error";
  if (status === 409 && code === "update_template_missing") {
    return { title: "Couldn't send", description: blockedModeNote(firstName) };
  }
  if (status === 429) return { title: "Couldn't send", description: "This update was just sent" };
  return { title: "Couldn't send", description: message };
}

/** True when a failed send means the window state we showed may be stale. */
export function isUpdateTemplateMissing(err: unknown): boolean {
  const e = (err ?? {}) as ErrorLike;
  return statusOf(e) === 409 && codeOf(e) === "update_template_missing";
}
