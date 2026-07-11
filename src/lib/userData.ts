import type { Feed, UserFeed, UserData, ArticleState, UserPreferences } from "../types";

const USER_DATA_KEY = "civicfeed_v2_user";
const CURRENT_VERSION = 1;

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultView: "list",
  reduceMotion: false,
};

const DEFAULT_ARTICLE_STATE: ArticleState = {
  read: [],
  bookmarked: [],
  archived: [],
};

function defaultUserData(): UserData {
  return {
    version: CURRENT_VERSION,
    feeds: [],
    articleState: { ...DEFAULT_ARTICLE_STATE },
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

export function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/$/, "");
}

export function loadUserData(): UserData {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (!raw) return defaultUserData();
    const parsed = JSON.parse(raw) as Partial<UserData>;
    return migrateUserData(parsed);
  } catch {
    return defaultUserData();
  }
}

function migrateUserData(parsed: Partial<UserData>): UserData {
  const base = defaultUserData();
  const version = typeof parsed.version === "number" ? parsed.version : 0;

  if (version < CURRENT_VERSION) {
    // Future migrations go here.
  }

  return {
    version: CURRENT_VERSION,
    feeds: Array.isArray(parsed.feeds)
      ? parsed.feeds.filter((f): f is UserFeed => !!f && f.userAdded === true)
      : base.feeds,
    articleState: {
      read: Array.isArray(parsed.articleState?.read) ? parsed.articleState.read : base.articleState.read,
      bookmarked: Array.isArray(parsed.articleState?.bookmarked)
        ? parsed.articleState.bookmarked
        : base.articleState.bookmarked,
      archived: Array.isArray(parsed.articleState?.archived)
        ? parsed.articleState.archived
        : base.articleState.archived,
    },
    preferences: {
      defaultView: parsed.preferences?.defaultView === "grid" ? "grid" : "list",
      reduceMotion: !!parsed.preferences?.reduceMotion,
    },
  };
}

export function saveUserData(data: UserData): void {
  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[UserData] Failed to persist user data:", e);
  }
}

function withUpdatedData(updater: (data: UserData) => UserData): UserData {
  const data = loadUserData();
  const updated = updater(data);
  saveUserData(updated);
  return updated;
}

function stableFeedId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `user-${Math.abs(hash).toString(36)}`;
}

export function createUserFeed(partial: Omit<Feed, "id" | "status" | "userAdded" | "enabled" | "addedAt">): UserFeed {
  return {
    ...partial,
    id: stableFeedId(partial.rssUrl),
    status: "unverified",
    userAdded: true,
    enabled: true,
    addedAt: Date.now(),
  };
}

export function getAllFeeds(staticFeeds: Feed[]): Feed[] {
  const userData = loadUserData();
  const userFeedMap = new Map(userData.feeds.map(f => [f.id, f]));
  const merged = staticFeeds.map(f => userFeedMap.get(f.id) ?? f);
  const staticIds = new Set(staticFeeds.map(f => f.id));
  const addedOnly = userData.feeds.filter(f => !staticIds.has(f.id));
  return [...merged, ...addedOnly];
}

export function getEnabledFeeds(staticFeeds: Feed[]): Feed[] {
  return getAllFeeds(staticFeeds).filter(f => {
    if (f.userAdded === true) return f.enabled;
    return true;
  });
}

export function addUserFeed(feed: UserFeed): UserData {
  return withUpdatedData(data => {
    const existingIndex = data.feeds.findIndex(f => f.rssUrl === feed.rssUrl || f.id === feed.id);
    if (existingIndex >= 0) {
      const existing = data.feeds[existingIndex];
      data.feeds[existingIndex] = { ...existing, ...feed, id: existing.id };
    } else {
      data.feeds.push(feed);
    }
    return data;
  });
}

export function updateUserFeed(id: string, updates: Partial<Omit<UserFeed, "id" | "userAdded" | "addedAt">>): UserData | null {
  return withUpdatedData(data => {
    const index = data.feeds.findIndex(f => f.id === id);
    if (index < 0) return data;
    data.feeds[index] = { ...data.feeds[index], ...updates };
    return data;
  });
}

export function removeUserFeed(id: string): UserData {
  return withUpdatedData(data => {
    data.feeds = data.feeds.filter(f => f.id !== id);
    return data;
  });
}

export function setFeedEnabled(id: string, enabled: boolean): UserData {
  return withUpdatedData(data => {
    const feed = data.feeds.find(f => f.id === id);
    if (feed) {
      feed.enabled = enabled;
    } else {
      // Static feed toggled off: store an override with enabled=false.
      const staticFeed = getAllFeeds([]).find(f => f.id === id);
      if (staticFeed && staticFeed.userAdded !== true) {
        data.feeds.push({
          ...staticFeed,
          userAdded: true,
          enabled,
          addedAt: Date.now(),
        });
      }
    }
    return data;
  });
}

export function isFeedEnabled(id: string): boolean {
  const data = loadUserData();
  const userFeed = data.feeds.find(f => f.id === id);
  if (userFeed) return userFeed.enabled;
  return true;
}

function toggleInArray(data: UserData, key: keyof ArticleState, value: string): UserData {
  const array = data.articleState[key];
  const index = array.indexOf(value);
  if (index >= 0) {
    array.splice(index, 1);
  } else {
    array.push(value);
  }
  return data;
}

function addToArray(data: UserData, key: keyof ArticleState, value: string): UserData {
  const array = data.articleState[key];
  if (!array.includes(value)) array.push(value);
  return data;
}

export function toggleBookmark(entryId: string): UserData {
  return withUpdatedData(data => toggleInArray(data, "bookmarked", entryId));
}

export function toggleRead(entryId: string): UserData {
  return withUpdatedData(data => toggleInArray(data, "read", entryId));
}

export function markRead(entryId: string): UserData {
  return withUpdatedData(data => addToArray(data, "read", entryId));
}

export function toggleArchived(entryId: string): UserData {
  return withUpdatedData(data => toggleInArray(data, "archived", entryId));
}

export function isBookmarked(entryId: string): boolean {
  return loadUserData().articleState.bookmarked.includes(entryId);
}

export function isRead(entryId: string): boolean {
  return loadUserData().articleState.read.includes(entryId);
}

export function isArchived(entryId: string): boolean {
  return loadUserData().articleState.archived.includes(entryId);
}

export function updatePreferences(updates: Partial<UserPreferences>): UserData {
  return withUpdatedData(data => {
    data.preferences = { ...data.preferences, ...updates };
    return data;
  });
}

export function getPreferences(): UserPreferences {
  return loadUserData().preferences;
}

export function importUserFeeds(feeds: UserFeed[]): UserData {
  return withUpdatedData(data => {
    for (const feed of feeds) {
      const existingIndex = data.feeds.findIndex(f => f.rssUrl === feed.rssUrl || f.id === feed.id);
      if (existingIndex >= 0) {
        data.feeds[existingIndex] = { ...data.feeds[existingIndex], ...feed };
      } else {
        data.feeds.push(feed);
      }
    }
    return data;
  });
}
