import { getApiBaseUrl } from "./apiConfig";

let warmed = false;

/**
 * Wakes the backend as soon as the app loads.
 *
 * The service runs on a free tier that sleeps after ~15 minutes idle, and
 * the first request afterwards pays a 30-50s cold start. Without this, that
 * cost lands on the user's first *deliberate* action ("Create Event" appears
 * to hang). Firing a health check at page load moves the wake-up into the
 * seconds the user spends reading the screen, so their first tap hits an
 * already-running server.
 *
 * Deliberately fire-and-forget: nothing depends on the result.
 */
export function warmUpBackend(): void {
  if (warmed) return;
  warmed = true;
  try {
    void fetch(`${getApiBaseUrl()}/api/v1/health`, {
      method: "GET",
      cache: "no-store",
      // keepalive so an immediate navigation doesn't cancel the wake-up
      keepalive: true,
    }).catch(() => {
      /* best effort only */
    });
  } catch {
    /* best effort only */
  }
}
