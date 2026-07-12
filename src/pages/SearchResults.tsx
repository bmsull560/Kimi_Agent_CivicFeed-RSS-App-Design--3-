import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import { useUserFeeds } from "../hooks/useUserFeeds";
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

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enabledFeeds } = useUserFeeds();

  const enabledIds = useMemo(() => new Set(enabledFeeds.map((f) => f.id)), [enabledFeeds]);

  useEffect(() => {
    const run = async () => {
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setResults([]);

      const apiBase = import.meta.env?.VITE_API_URL || "";
      const candidates = new Set<string>([apiBase]);
      if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        candidates.add("http://localhost:4000");
      }

      for (const base of candidates) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const r = await fetch(`${base}/api/search?q=${encodeURIComponent(q)}&limit=50`, { signal: controller.signal });
          clearTimeout(timer);

          if (!r.ok) continue;
          const data = (await r.json()) as { results?: SearchResultItem[] };
          setResults((data.results || []).filter((item) => enabledIds.has(item.feedId)));
          setLoading(false);
          return;
        } catch {
          // Try next candidate.
        }
      }

      setError("Search unavailable. Is the backend running?");
      setLoading(false);
    };

    void run();
  }, [q, enabledIds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Search size={20} className="text-slate-400" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {q ? `Search: "${q}"` : "Search Articles"}
          </h1>
          {!loading && q && (
            <p className="text-sm text-slate-500">
              {results.length} result{results.length !== 1 ? "s" : ""}
              {error && ` — ${error}`}
            </p>
          )}
        </div>
      </div>

      {loading && results.length === 0 && (
        <div className="card p-8 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Searching…
        </div>
      )}

      {!loading && q && results.length === 0 && (
        <EmptyState
          message="No articles found"
          subMessage={error || `No results for "${q}". Try different keywords or visit a feed to cache more articles.`}
        />
      )}

      {!loading && results.length > 0 && (
        <div className="card divide-y divide-slate-100 px-5">
          {results.map((r) => (
            <EntryCard key={r.entryId} entry={toEntry(r)} />
          ))}
        </div>
      )}

      {!q && (
        <EmptyState
          message="Enter a search term"
          subMessage="Search across cached article titles, descriptions, summaries, and tags from enabled feeds."
        />
      )}
    </div>
  );
}
