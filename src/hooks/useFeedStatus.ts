import { useState, useEffect, useCallback } from "react";
import type { FeedFetchStatus } from "../types";
import { fetchFeedStatus } from "../lib/rss";

interface FeedStatusState {
  status: FeedFetchStatus | null;
  loading: boolean;
  error: string | null;
}

export function useFeedStatus(feedId: string | undefined): FeedStatusState & { refresh: () => void } {
  const [state, setState] = useState<FeedStatusState>({
    status: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(() => {
    if (!feedId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchFeedStatus(feedId)
      .then((result) => setState({ status: result, loading: false, error: null }))
      .catch((err) => setState({ status: null, loading: false, error: err instanceof Error ? err.message : String(err) }));
  }, [feedId]);

  useEffect(() => {
    if (!feedId) return;
    fetchFeedStatus(feedId)
      .then((result) => setState({ status: result, loading: false, error: null }))
      .catch((err) => setState({ status: null, loading: false, error: err instanceof Error ? err.message : String(err) }));
  }, [feedId]);

  return { ...state, refresh };
}
