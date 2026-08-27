/**
 * Helper utility for resolving the API Base URL dynamically across environments:
 * 1. Explicit import.meta.env.VITE_API_URL
 * 2. Explicit window.__CADENCE_API_URL__ override
 * 3. Render deployment auto-fallback for onrender.com hostnames
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
    if (host.endsWith(".onrender.com") && !host.includes("backend") && !host.includes("api")) {
      // Fallback for Render static sites where VITE_API_URL was not set at build time
      return "https://semeval-backend.onrender.com";
    }
  }

  return "";
}
