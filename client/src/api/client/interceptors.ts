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
      if (!url.includes("/api/auth/")) {
        window.location.href = "/";
      }
    }
    const message =
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      "Request failed";
    return Promise.reject(new Error(message));
  },
);

export default axiosClient;
