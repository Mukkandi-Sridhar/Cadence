/**
 * Tiny localStorage cache for a stale-while-revalidate read pattern.
 *
 * Every screen used to start from a blank spinner and wait on the network
 * before showing anything — painful on a free-tier backend that sleeps and
 * takes tens of seconds to wake. Now the last known data paints immediately
 * and the network result quietly replaces it when it lands.
 *
 * localStorage (not sessionStorage) on purpose: the point is that reopening
 * the app tomorrow still paints instantly, not just within one tab session.
 */

const PREFIX = "cadence_cache_v1:";
/** Cached data older than this is ignored — better a spinner than a stale lie. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  at: number;
  data: T;
}

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    const envelope: CacheEnvelope<T> = { at: Date.now(), data };
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or storage disabled (private mode) — caching is an
    // optimisation, never a requirement, so failing here is fine.
  }
}

export function dropCache(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Drops every cache entry whose key starts with `prefix`. */
export function dropCacheMatching(prefix: string): void {
  try {
    const full = PREFIX + prefix;
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(full)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// ── Cache keys ───────────────────────────────────────────────────────────────
export const cacheKeys = {
  events: () => "events",
  event: (eventId: string) => `event:${eventId}`,
  presentations: (eventId: string) => `presentations:${eventId}`,
  presentation: (presId: string) => `presentation:${presId}`,
  score: (presId: string) => `score:${presId}`,
};
