import { useState, useEffect, useCallback } from "react";
import type { FeedFetchStatus, FeedHealth } from "../types";
import { fetchFeedStatus, fetchFeedHealth } from "../lib/rss";

interface FeedStatusState {
  status: FeedFetchStatus | null;
  health: FeedHealth | null;
  loading: boolean;
  error: string | null;
}

export function useFeedStatus(
  feedId: string | undefined
): FeedStatusState & { refresh: () => void } {
  const [state, setState] = useState<FeedStatusState>({
    status: null,
    health: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(() => {
    if (!feedId) return;
    setState((s) => ({ ...s, loading: true, error: null }));

    Promise.all([fetchFeedStatus(feedId), fetchFeedHealth(feedId)])
      .then(([status, health]) => {
        setState({ status, health, loading: false, error: null });
      })
      .catch((err) => {
        setState({
          status: null,
          health: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [feedId]);

  useEffect(() => {
    // Data-fetching effect: load diagnostics once when feedId changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
