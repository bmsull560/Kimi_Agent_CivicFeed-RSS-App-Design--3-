import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { useUserFeeds } from "../hooks/useUserFeeds";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import { loadUserData } from "../lib/userData";
import type { RssEntry, SearchResultItem } from "../types";

function toEntry(r: SearchResultItem): RssEntry {
  return {
    id: r.entryId,
    title: r.title,
    link: r.link,
    description: r.description,
    pubDate: r.pubDate,
    author: r.author || undefined,
    feedId: r.feedId,
    feedName: r.feedName,
    fetchedAt: 0,
    aiSummary: r.aiSummary,
    aiTags: r.aiTags,
  };
}

async function fetchArticlesByIds(ids: string[]): Promise<RssEntry[]> {
  if (ids.length === 0) return [];
  const apiBase = import.meta.env?.VITE_API_URL || "";
  const candidates = new Set<string>([apiBase]);
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    candidates.add("http://localhost:4000");
  }

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/api/articles/by-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: SearchResultItem[] };
      return (data.results || []).map(toEntry);
    } catch {
      // try next candidate
    }
  }
  return [];
}

export default function Bookmarks() {
  const { enabledFeeds } = useUserFeeds();
  const [entries, setEntries] = useState<RssEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const ids = loadUserData().articleState.bookmarked;
      const found = await fetchArticlesByIds(ids);
      const enabledIds = new Set(enabledFeeds.map((f) => f.id));
      setEntries(found.filter((e) => enabledIds.has(e.feedId)));
      setLoading(false);
    };

    void load();
  }, [enabledFeeds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bookmark size={22} className="text-amber-500" />
        <h1 className="text-xl font-bold text-slate-900">Bookmarks</h1>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Loading bookmarks…</p>
      ) : entries.length === 0 ? (
        <EmptyState
          message="No bookmarks yet"
          subMessage="Bookmark articles from the reading stream or feed detail to save them here."
        />
      ) : (
        <div className="card divide-y divide-slate-100 px-5">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
