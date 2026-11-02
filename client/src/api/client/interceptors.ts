import axiosClient from "./axios-client";
import { writeAuthNotice } from "@/lib/auth-notice";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

axiosClient.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === "object" &&
      "data" in response.data &&
      response.data.data !== undefined
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // A suspended or removed user's session is ended by the server; keep the reason for the sign-in page.
      writeAuthNotice(typeof window === "undefined" ? null : window.sessionStorage, (error.response.data as { code?: unknown } | undefined)?.code);
      const url = error.config?.url || "";
      const skipRedirectPaths = ["/api/auth/", "/api/v2/users/profiles/", "/api/public/", "/api/v2/quote-share/"];
      if (!skipRedirectPaths.some((p) => url.includes(p))) {
        // Soft re-auth instead of `window.location.href = "/"`: a full reload
        // mid-navigation looks like the page "loading twice". The app listens
        // for this and re-validates the session via React Query — if it's
        // genuinely gone the landing/login view renders, with no hard reload.
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    const responseData = (error.response?.data ?? {}) as Record<string, unknown>;
    if (error.response?.status === 403 && responseData.code === "ORG_SUSPENDED") {
      // The agency was suspended mid-session. The session stays alive server-side (unsuspending
      // restores it), so show the reason on the sign-in page and re-validate. Auth endpoints never
      // trigger re-validation (it would loop), and login shows the message inline instead.
      const url = error.config?.url || "";
      if (!url.includes("/api/auth/login")) {
        writeAuthNotice(typeof window === "undefined" ? null : window.sessionStorage, responseData.code);
      }
      if (!url.includes("/api/auth/")) {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    const message =
      (responseData.message as string | undefined) ||
      error.message ||
      "Request failed";
    const wrapped = new Error(message) as Error & {
      status?: number;
      code?: string;
      data?: Record<string, unknown>;
    };
    wrapped.status = error.response?.status;
    wrapped.code = responseData.code as string | undefined;
    wrapped.data = responseData;
    return Promise.reject(wrapped);
  },
);

export default axiosClient;
