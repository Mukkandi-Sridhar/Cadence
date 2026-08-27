/**
 * Helper utility for resolving the API Base URL dynamically across environments:
 * 1. Explicit import.meta.env.VITE_API_URL if set
 * 2. Explicit window.__CADENCE_API_URL__ override
 * 3. Render static site (cadence-l1a9.onrender.com) -> targets backend (https://cadence-api.onrender.com)
 * 4. Local / same-origin fallback
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

    const host = window.location.hostname;
    if (host.endsWith(".onrender.com") && !host.includes("cadence-api") && !host.includes("backend")) {
      return "https://cadence-api.onrender.com";
    }
  }

  return "";
}
