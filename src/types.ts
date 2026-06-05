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
}

export interface CacheEntry {
  feedId: string;
  entries: RssEntry[];
  fetchedAt: number;
  accessedAt: number;
  etag?: string;
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
