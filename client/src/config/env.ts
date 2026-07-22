/**
 * Centralized access to client environment configuration.
 *
 * Vite exposes build-time variables (and any `VITE_`-prefixed vars) on
 * `import.meta.env`. Read them here so the rest of the app imports a typed
 * object from `@/config/env` rather than touching `import.meta.env` directly.
 */
export const env = {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  /**
   * Public base URL for building externally-shared links (e.g. quote share
   * links). Falls back to `window.location.origin` when unset so local dev
   * keeps working without configuring `VITE_PUBLIC_APP_URL`.
   */
  publicBaseUrl: (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, ""),
} as const;

export type Env = typeof env;
