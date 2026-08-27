/**
 * Helper utility for resolving the API Base URL dynamically across environments:
 * 1. Explicit import.meta.env.VITE_API_URL if set
 * 2. Explicit window.__CADENCE_API_URL__ override
 * 3. Default: empty string "" (uses relative /api/v1/* calls on same origin)
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

  // Same-origin relative paths ("") eliminate CORS issues completely
  return "";
}
