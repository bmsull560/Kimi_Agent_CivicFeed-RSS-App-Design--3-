import { useCallback, useMemo, useState } from "react";
import type { Feed, UserFeed } from "../types";
import { useFeeds } from "./useFeeds";
import {
  addUserFeed,
  createUserFeed,
  getAllFeeds,
  getEnabledFeeds,
  importUserFeeds,
  loadUserData,
  normalizeUrl,
  removeUserFeed,
  setFeedEnabled,
  updateUserFeed,
} from "../lib/userData";

export interface UseUserFeedsResult {
  allFeeds: Feed[];
  enabledFeeds: Feed[];
  catalogLoading: boolean;
  catalogError: string | null;
  addFeed: (feed: Omit<Feed, "id" | "status" | "userAdded" | "enabled" | "addedAt">) => boolean;
  updateFeed: (id: string, updates: Partial<Omit<UserFeed, "id" | "userAdded" | "addedAt">>) => boolean;
  removeFeed: (id: string) => void;
  toggleFeedEnabled: (id: string) => void;
  importFeeds: (feeds: UserFeed[]) => void;
  refresh: () => void;
}

export function useUserFeeds(): UseUserFeedsResult {
  const { feeds: catalogFeeds, loading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useFeeds();
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    refreshCatalog();
    setTick((t) => t + 1);
  }, [refreshCatalog]);

  const allFeeds = useMemo(() => {
    // tick is read to force re-computation when user data changes.
    void tick;
    return getAllFeeds(catalogFeeds);
  }, [catalogFeeds, tick]);

  const enabledFeeds = useMemo(() => {
    void tick;
    return getEnabledFeeds(catalogFeeds);
  }, [catalogFeeds, tick]);

  const addFeed = useCallback(
    (partial: Omit<Feed, "id" | "status" | "userAdded" | "enabled" | "addedAt">) => {
      const normalized = normalizeUrl(partial.rssUrl);
      const duplicate = allFeeds.find((f) => normalizeUrl(f.rssUrl) === normalized);
      if (duplicate) {
        alert(`A feed with this URL already exists as "${duplicate.shortName}".`);
        return false;
      }
      const feed = createUserFeed(partial);
      addUserFeed(feed);
      refresh();
      return true;
    },
    [allFeeds, refresh],
  );

  const updateFeed = useCallback(
    (id: string, updates: Partial<Omit<UserFeed, "id" | "userAdded" | "addedAt">>) => {
      const current = loadUserData().feeds.find((f) => f.id === id);
      if (!current) return false;
      if (updates.rssUrl) {
        const normalized = normalizeUrl(updates.rssUrl);
        const duplicate = allFeeds.find(
          (f) => f.id !== id && normalizeUrl(f.rssUrl) === normalized,
        );
        if (duplicate) {
          alert(`A feed with this URL already exists as "${duplicate.shortName}".`);
          return false;
        }
      }
      updateUserFeed(id, updates);
      refresh();
      return true;
    },
    [allFeeds, refresh],
  );

  const removeFeed = useCallback(
    (id: string) => {
      removeUserFeed(id);
      refresh();
    },
    [refresh],
  );

  const toggleFeedEnabled = useCallback(
    (id: string) => {
      const feed = allFeeds.find((f) => f.id === id);
      const next = !(feed?.enabled ?? true);
      setFeedEnabled(id, next);
      refresh();
    },
    [allFeeds, refresh],
  );

  const importFeeds = useCallback(
    (feeds: UserFeed[]) => {
      const existingUrls = new Set(allFeeds.map((f) => normalizeUrl(f.rssUrl)));
      const newFeeds = feeds.filter((f) => !existingUrls.has(normalizeUrl(f.rssUrl)));
      if (newFeeds.length < feeds.length) {
        alert(`Skipped ${feeds.length - newFeeds.length} duplicate feed(s).`);
      }
      if (newFeeds.length > 0) {
        importUserFeeds(newFeeds);
        refresh();
      }
    },
    [allFeeds, refresh],
  );

  return {
    allFeeds,
    enabledFeeds,
    catalogLoading,
    catalogError,
    addFeed,
    updateFeed,
    removeFeed,
    toggleFeedEnabled,
    importFeeds,
    refresh,
  };
}
