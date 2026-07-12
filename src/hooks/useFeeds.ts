import { useState, useEffect, useCallback } from "react";
import type { FeedsApiResponse, Feed } from "../types";

const API_BASE = import.meta.env?.VITE_API_URL || "";

function getApiBaseCandidates(): string[] {
  const candidates = new Set<string>();
  candidates.add(API_BASE);

  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    candidates.add("http://localhost:4000");
  }

  return [...candidates];
}

export interface UseFeedsResult {
  feeds: Feed[];
  categoryList: string[];
  feedStats: { total: number; working: number; categories: number } | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Load the canonical feed catalog from the backend API.
 *
 * The backend is the single source of truth for the catalog; the frontend no
 * longer bundles a static feed list. User-added feeds are merged separately in
 * useUserFeeds.
 */
export function useFeeds(): UseFeedsResult {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [feedStats, setFeedStats] = useState<UseFeedsResult["feedStats"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    for (const apiBase of getApiBaseCandidates()) {
      try {
        const res = await fetch(`${apiBase}/api/feeds`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) continue;

        const data = (await res.json()) as FeedsApiResponse;
        setFeeds(data.feeds || []);
        setCategoryList(data.categoryList || []);
        setFeedStats(data.feedStats || null);
        setLoading(false);
        return;
      } catch {
        // Try next candidate.
      }
    }

    setError("Unable to load feed catalog. Is the backend running?");
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data-fetching effect: load the canonical catalog once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return {
    feeds,
    categoryList,
    feedStats,
    loading,
    error,
    refresh,
  };
}
