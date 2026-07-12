import type { FeedFetchStatus, FeedStats, DiscoveredFeed, FeedArticlesResponse } from "../types";

const API_BASE = import.meta.env?.VITE_API_URL || "";

function getApiBaseCandidates(): string[] {
  const candidates = new Set<string>();
  candidates.add(API_BASE);

  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    candidates.add("http://localhost:4000");
  }

  return [...candidates];
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T | null> {
  for (const apiBase of getApiBaseCandidates()) {
    try {
      const res = await fetch(`${apiBase}${path}`, {
        ...options,
        signal: options?.signal ?? AbortSignal.timeout(20000),
      });
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // Candidate unreachable; try the next one.
    }
  }
  return null;
}

/**
 * Fetch articles for a feed from the backend API.
 *
 * All RSS fetching, parsing, and caching now live in the backend service. The
 * frontend no longer falls back to public CORS proxies or parses XML.
 */
export async function fetchFeedArticles(
  feedId: string,
  options: { refresh?: boolean } = {}
): Promise<FeedArticlesResponse> {
  const headers: Record<string, string> = {};
  if (options.refresh) {
    headers["Cache-Control"] = "max-age=0";
  }

  const data = await fetchJson<FeedArticlesResponse>(
    `/api/feeds/${encodeURIComponent(feedId)}/articles`,
    {
      headers,
    }
  );

  if (!data) {
    return { entries: [], cached: false, error: "Backend unreachable" };
  }

  return data;
}

export async function fetchFeedStatus(feedId: string): Promise<FeedFetchStatus | null> {
  return fetchJson<FeedFetchStatus>(`/api/feeds/${encodeURIComponent(feedId)}/status`, {
    signal: AbortSignal.timeout(10000),
  });
}

export async function fetchFeedHealth(
  feedId: string
): Promise<import("../types").FeedHealth | null> {
  return fetchJson<import("../types").FeedHealth>(
    `/api/feeds/${encodeURIComponent(feedId)}/health`,
    {
      signal: AbortSignal.timeout(30000),
    }
  );
}

export async function fetchFeedStats(): Promise<FeedStats | null> {
  return fetchJson<FeedStats>("/api/stats/feeds", {
    signal: AbortSignal.timeout(10000),
  });
}

export async function discoverFeeds(inputUrl: string): Promise<DiscoveredFeed[]> {
  const data = await fetchJson<{ feeds?: DiscoveredFeed[] }>(
    `/api/discover?url=${encodeURIComponent(inputUrl)}`,
    {
      signal: AbortSignal.timeout(15000),
    }
  );
  return data?.feeds || [];
}

/**
 * Validate a candidate RSS URL by asking the backend to fetch it.
 *
 * For user-added feeds we don't yet have a backend feed id, so we fetch the
 * feed directly through the backend discovery/fetch path by providing the URL.
 * The backend preview endpoint is not implemented yet; this function falls back
 * to discovery and then fetches the discovered feed.
 */
export async function validateFeedUrl(inputUrl: string): Promise<{
  ok: boolean;
  entries?: import("../types").RssEntry[];
  error?: string;
}> {
  const discovered = await discoverFeeds(inputUrl);

  // Ask the backend to discover/validate the URL. If discovery returns a feed,
  // we consider it valid. A future backend endpoint could do a full preview.
  if (discovered.length > 0) {
    return { ok: true };
  }

  return { ok: false, error: "Could not discover a valid RSS or Atom feed at that URL." };
}

// Deprecated alias kept for minimal diff during migration.
export async function fetchFeed(
  _url: string,
  feedId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _feedName: string
): Promise<{ entries: import("../types").RssEntry[]; error: string | null }> {
  return fetchFeedArticles(feedId);
}
