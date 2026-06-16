import { useState, useEffect, useRef, useCallback } from "react";
import type { FetchState } from "../types";
import { fetchFeed } from "../lib/rss";
import { getCachedFeed, isCacheFresh, setCachedFeed } from "../lib/cache";

export function useRssFeed(feedUrl: string, feedId: string, feedName: string): FetchState & { refresh: () => void } {
  const [state, setState] = useState<FetchState>({ status: "idle", entries: [], error: null, lastFetched: null });
  const requestIdRef = useRef(0);

  const doFetch = useCallback(async (force: boolean) => {
    if (!feedUrl || !feedId) return;
    const requestId = ++requestIdRef.current;
    const cached = getCachedFeed(feedId, { allowStale: true });

    if (!force) {
      if (cached && cached.entries.length > 0) {
        setState({ status: "success", entries: cached.entries, error: null, lastFetched: cached.fetchedAt });
        if (isCacheFresh(cached)) return;
      }
    }

    setState(s => ({ ...s, status: "loading", error: null }));
    const result = await fetchFeed(feedUrl, feedId, feedName);
    if (requestId !== requestIdRef.current) return;

    if (result.error || result.entries.length === 0) {
      setState(s => ({
        status: "error",
        entries: s.entries,
        error: result.error || "No entries found",
        lastFetched: s.lastFetched,
      }));
      return;
    }

    setCachedFeed(feedId, result.entries);
    setState({ status: "success", entries: result.entries, error: null, lastFetched: Date.now() });
  }, [feedUrl, feedId, feedName]);

  useEffect(() => {
    void Promise.resolve().then(() => doFetch(false));
    return () => {
      requestIdRef.current += 1;
    };
  }, [doFetch]);

  const refresh = useCallback(() => doFetch(true), [doFetch]);
  return { ...state, refresh };
}
