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
      const skipRedirectPaths = ["/api/auth/", "/api/user-profiles/", "/api/public/", "/api/quote-share/"];
      if (!skipRedirectPaths.some((p) => url.includes(p))) {
        window.location.href = "/";
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
