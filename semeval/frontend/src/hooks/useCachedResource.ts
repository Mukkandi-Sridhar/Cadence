import { useCallback, useEffect, useRef, useState } from "react";
import { readCache, writeCache } from "../lib/cache";

interface CachedResource<T> {
  /** Cached value on first paint, then the fresh one. */
  data: T | null;
  /** Only true when there is nothing cached to show yet. */
  loading: boolean;
  /** A background refresh is in flight over already-visible data. */
  refreshing: boolean;
  error: string | null;
  /** Update the value locally (and in cache) — for optimistic updates. */
  mutate: (updater: T | ((current: T | null) => T)) => void;
  refresh: () => void;
}

/**
 * Stale-while-revalidate fetch: paint whatever was cached last time
 * immediately, then refresh in the background.
 *
 * `loading` is deliberately only true on a true cold start (nothing cached),
 * so returning to a screen never flashes a spinner over data the user has
 * already seen.
 */
export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  enabled = true
): CachedResource<T> {
  const [data, setData] = useState<T | null>(() => (enabled ? readCache<T>(key) : null));
  const [loading, setLoading] = useState(() => enabled && readCache<T>(key) === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest fetcher without making it a re-run trigger — callers
  // usually pass an inline arrow, which would otherwise loop forever.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const cached = readCache<T>(key);
    if (cached !== null) {
      setData(cached);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    (async () => {
      try {
        const fresh = await fetcherRef.current();
        if (cancelled) return;
        setData(fresh);
        writeCache(key, fresh);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        // A failed refresh must not wipe good cached data off the screen.
        const message =
          err instanceof Error ? err.message : "Could not reach the server.";
        setError(readCache<T>(key) !== null ? null : message);
        if (readCache<T>(key) !== null) {
          console.warn(`Background refresh failed for "${key}":`, err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, enabled, nonce]);

  const mutate = useCallback(
    (updater: T | ((current: T | null) => T)) => {
      setData((current) => {
        const next =
          typeof updater === "function"
            ? (updater as (c: T | null) => T)(current)
            : updater;
        writeCache(key, next);
        return next;
      });
    },
    [key]
  );

  return { data, loading, refreshing, error, mutate, refresh };
}
