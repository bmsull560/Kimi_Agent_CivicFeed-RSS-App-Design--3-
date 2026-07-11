import { useCallback } from "react";
import type { RssEntry, CacheEntry } from "../types";
import { getCachedFeed, setCachedFeed, invalidateFeed, invalidateAll, getCacheStats, getAllCachedEntries } from "../lib/cache";

export function useFeedCache() {
  const getCached = useCallback((feedId: string): CacheEntry | null => getCachedFeed(feedId), []);
  const setCached = useCallback((feedId: string, entries: RssEntry[]): void => setCachedFeed(feedId, entries), []);
  const invalidate = useCallback((feedId: string): void => invalidateFeed(feedId), []);
  const clearAll = useCallback((): void => invalidateAll(), []);
  const stats = useCallback(() => getCacheStats(), []);
  const allCached = useCallback((includeStale = false) => getAllCachedEntries(includeStale), []);
  return { getCached, setCached, invalidate, clearAll, stats, allCached };
}
