import { useState, useEffect, useRef, useCallback } from "react";
import type { FetchState } from "../types";
import { fetchFeed } from "../lib/rss";
import { getCachedFeed, setCachedFeed } from "../lib/cache";

export function useRssFeed(feedUrl: string, feedId: string, feedName: string): FetchState & { refresh: () => void } {
  const [state, setState] = useState<FetchState>({ status: "idle", entries: [], error: null, lastFetched: null });
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(async (force: boolean) => {
    if (!feedUrl) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    if (!force) {
      const cached = getCachedFeed(feedId);
      if (cached && cached.entries.length > 0) {
        setState({ status: "success", entries: cached.entries, error: null, lastFetched: cached.fetchedAt });
        return;
      }
    }
    setState(s => ({ ...s, status: "loading", error: null }));
    const result = await fetchFeed(feedUrl, feedId, feedName);
    if (abortRef.current.signal.aborted) return;
    if (result.error || result.entries.length === 0) {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => doFetch(true), 2000);
      setState({ status: "error", entries: [], error: result.error || "No entries found", lastFetched: null });
      return;
    }
    setCachedFeed(feedId, result.entries);
    setState({ status: "success", entries: result.entries, error: null, lastFetched: Date.now() });
  }, [feedUrl, feedId, feedName]);

  useEffect(() => {
    doFetch(false);
    return () => { if (abortRef.current) abortRef.current.abort(); if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, [doFetch]);

  const refresh = useCallback(() => doFetch(true), [doFetch]);
  return { ...state, refresh };
}
