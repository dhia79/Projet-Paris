/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the Go backend (services/api-go), e.g. http://localhost:8080.
   * When unset the dashboard falls back to normalizing Open Data Paris in the
   * browser, so the UI still runs with no backend deployed.
   */
  readonly VITE_API_BASE_URL?: string
  readonly VITE_OPENDATA_BASE_URL?: string
  /** `'false'` silences every non-error log. */
  readonly VITE_ENABLE_LOGS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
