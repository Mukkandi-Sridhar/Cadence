/**
 * Helper utility for resolving the API Base URL.
 *
 * The app is deployed as a single combined service: the FastAPI backend
 * serves both the API and the built frontend SPA from the same origin
 * (see semeval/backend/semeval/main.py's static-file fallback), so the
 * default is always same-origin (relative "/api/..." fetches) — no CORS
 * involved. Only override when explicitly configured:
 * 1. import.meta.env.VITE_API_URL (build-time env var)
 * 2. window.__CADENCE_API_URL__ (runtime override, e.g. injected by ops)
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const win = window as unknown as { __CADENCE_API_URL__?: string };
    if (win.__CADENCE_API_URL__) {
      return win.__CADENCE_API_URL__.replace(/\/$/, "");
    }
  }

  return "";
}
