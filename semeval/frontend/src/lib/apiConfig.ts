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

/** Thrown when the server responded but with a non-2xx status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string
  ) {
    super(detail || `Request failed (${status})`);
    this.name = "ApiError";
  }
}

interface ApiFetchOptions extends RequestInit {
  /** Abort after this many ms. Default 30s; raise it for long AI calls. */
  timeoutMs?: number;
  /** Retry attempts for transient failures (network drop / 5xx). Default 2. */
  retries?: number;
}

function isTransient(err: unknown): boolean {
  // A dropped connection or a timeout — worth retrying. A 4xx is not.
  if (err instanceof ApiError) return err.status >= 500 && err.status !== 501;
  return true;
}

async function extractDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      return parsed.detail || text;
    } catch {
      return text;
    }
  } catch {
    return "";
  }
}

/**
 * fetch() with a timeout and automatic retry on transient failures.
 *
 * The app is used on college wifi and phone hotspots where requests stall or
 * drop regularly, and the backend runs on a free tier that cold-starts after
 * idling (the first request after a nap can take the better part of a
 * minute). A bare fetch() with no timeout and no retry turns both of those
 * routine conditions into a dead end for the user.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 30_000, retries = 2, ...init } = options;
  const url = `${getApiBaseUrl()}${path}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!res.ok) {
        const detail = await extractDetail(res);
        throw new ApiError(res.status, detail);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isTransient(err)) break;
      // Back off a little before retrying — helps a cold-starting server.
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastErr instanceof ApiError) throw lastErr;
  throw new Error(
    "Could not reach the server. Check your internet connection and try again."
  );
}

export async function apiJson<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, options);
  return (await res.json()) as T;
}
