export interface Feed {
  id: string;
  name: string;
  shortName: string;
  agency: string;
  description: string;
  rssUrl: string;
  website: string;
  department: string;
  category: string;
  subCategory: string;
  contentType: string;
  updateFrequency: string;
  status: "working" | "blocked" | "unverified";
  tags: string[];
  priority?: 1 | 2 | 3 | 4 | 5 | 6;
  userAdded?: boolean;
  enabled?: boolean;
  addedAt?: number;
  healthStatus?: "ok" | "warn" | "fail" | null;
  healthCheckedAt?: number | null;
  healthError?: string | null;
}

export interface UserFeed extends Feed {
  userAdded: true;
  enabled: boolean;
  addedAt: number;
}

export interface ArticleState {
  read: string[];
  bookmarked: string[];
  archived: string[];
}

export interface UserPreferences {
  defaultView: "list" | "grid";
  reduceMotion: boolean;
  onboardingComplete?: boolean;
  followedHubs?: string[];
  digestFrequency?: "realtime" | "daily" | "weekly" | null;
}

export interface UserData {
  version: number;
  feeds: UserFeed[];
  articleState: ArticleState;
  preferences: UserPreferences;
}

export interface RssEntry {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author?: string;
  categories?: string[];
  feedId: string;
  feedName: string;
  fetchedAt: number;
  aiSummary?: string;
  aiSummarySource?: "ollama" | "openai" | "extractive";
  aiTags?: string[];
}

export interface FetchState {
  status: "idle" | "loading" | "success" | "error";
  entries: RssEntry[];
  error: string | null;
  lastFetched: number | null;
}

export interface FetchResult {
  entries: RssEntry[];
  error: string | null;
}

export interface FeedFetchStatus {
  feedId: string;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  attemptCount: number;
  successCount: number;
  failureCount: number;
  nextFetchAt: number | null;
}

export interface FeedHealth {
  feedId: string;
  status: "ok" | "warn" | "fail";
  checks: {
    reachable: boolean;
    validXml: boolean;
    validSchema: boolean;
    stableGuids: boolean;
    saneDates: boolean;
    usableContent: boolean;
    fresh: boolean;
  };
  newestItemDate: string | null;
  responseTimeMs: number;
  lastValidatedAt: number;
  error?: string;
}

/** Aggregate feed stats from /api/stats/feeds. */
export interface FeedStats {
  totalFeeds: number;
  workingFeeds: number;
  feedsWithStatus: number;
  feedsWithRecentError: number;
  staleFeeds: number;
}

/** Catalog summary returned by /api/feeds. */
export interface FeedCatalogSummary {
  total: number;
  working: number;
  categories: number;
}

export interface DiscoveredFeed {
  href: string;
  type: string;
  title: string;
}

export interface SearchResultItem {
  entryId: string;
  feedId: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author: string | null;
  feedName: string;
  rank?: number;
  aiSummary?: string;
  aiTags?: string[];
}

export interface FeedArticlesResponse {
  entries: RssEntry[];
  cached: boolean;
  error: string | null;
}

export interface FeedsApiResponse {
  feeds: Feed[];
  categoryList: string[];
  feedStats: FeedCatalogSummary;
}
