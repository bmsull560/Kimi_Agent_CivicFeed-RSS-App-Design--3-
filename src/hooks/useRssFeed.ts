import { useState, useEffect, useRef, useCallback } from "react";
import type { FetchState } from "../types";
import { fetchFeedArticles } from "../lib/rss";

export function useRssFeed(feedUrl: string, feedId: string): FetchState & { refresh: () => void } {
  const [state, setState] = useState<FetchState>({
    status: "idle",
    entries: [],
    error: null,
    lastFetched: null,
  });
  const requestIdRef = useRef(0);

  const doFetch = useCallback(
    async (force: boolean) => {
      if (!feedUrl || !feedId) return;
      const requestId = ++requestIdRef.current;

      setState((s) => ({
        ...s,
        status: s.entries.length > 0 ? "loading" : "loading",
        error: null,
      }));
      const result = await fetchFeedArticles(feedId, { refresh: force });
      if (requestId !== requestIdRef.current) return;

      if (result.error || result.entries.length === 0) {
        setState((s) => ({
          status: "error",
          entries: s.entries,
          error: result.error || "No entries found",
          lastFetched: s.lastFetched,
        }));
        return;
      }

      setState({
        status: "success",
        entries: result.entries,
        error: null,
        lastFetched: result.entries[0]?.fetchedAt || Date.now(),
      });
    },
    [feedUrl, feedId]
  );

  useEffect(() => {
    void Promise.resolve().then(() => doFetch(false));
    return () => {
      requestIdRef.current += 1;
    };
  }, [doFetch]);

  const refresh = useCallback(() => doFetch(true), [doFetch]);
  return { ...state, refresh };
}
