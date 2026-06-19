import axiosClient from "./axios-client";
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
