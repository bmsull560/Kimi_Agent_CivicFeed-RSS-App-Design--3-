import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import { useUserFeeds } from "../hooks/useUserFeeds";
import { useFeedCache } from "../hooks/useFeedCache";
import type { RssEntry } from "../types";

interface SearchResultItem {
  entryId: string;
  feedId: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author: string | null;
  feedName: string;
  aiSummary?: string;
  aiTags?: string[];
}

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
  const [augmentedFromBackend, setAugmentedFromBackend] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const { enabledFeeds } = useUserFeeds();
  const { allCached } = useFeedCache();

  const enabledIds = useMemo(() => new Set(enabledFeeds.map(f => f.id)), [enabledFeeds]);

  const localResults = useMemo(() => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return allCached(true)
      .filter(c => enabledIds.has(c.feedId))
      .flatMap(c => c.entries)
      .filter(e =>
        e.title.toLowerCase().includes(lower) ||
        e.description.toLowerCase().includes(lower) ||
        e.feedName.toLowerCase().includes(lower) ||
        (e.categories?.some(c => c.toLowerCase().includes(lower)) ?? false)
      )
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .map(e => ({
        entryId: e.id,
        feedId: e.feedId,
        title: e.title,
        link: e.link,
        description: e.description,
        pubDate: e.pubDate,
        author: e.author || null,
        feedName: e.feedName,
        aiSummary: e.aiSummary,
        aiTags: e.aiTags,
      }));
  }, [q, allCached, enabledIds]);

  useEffect(() => {
    const run = async () => {
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        setAugmentedFromBackend(false);
        return;
      }

      setLoading(true);
      setResults(localResults);
      setAugmentedFromBackend(false);
      setBackendAvailable(null);

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        clearTimeout(timer);

        if (!r.ok) {
          setBackendAvailable(false);
          return;
        }
        const data = (await r.json()) as { results?: SearchResultItem[] };
        const serverResults = data.results || [];
        if (serverResults.length === 0) {
          setBackendAvailable(true);
          return;
        }

        // Merge server results (which may include enriched summaries/tags) with local results.
        const merged = new Map<string, SearchResultItem>();
        for (const item of serverResults) merged.set(item.entryId, item);
        for (const item of localResults) {
          if (!merged.has(item.entryId)) merged.set(item.entryId, item);
        }
        setResults([...merged.values()]);
        setAugmentedFromBackend(true);
        setBackendAvailable(true);
      } catch {
        // Backend is optional; local results are already displayed.
        setBackendAvailable(false);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [q, localResults]);

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
              {augmentedFromBackend && " (augmented from backend)"}
              {backendAvailable === false && " (local cache only — backend unavailable)"}
            </p>
          )}
        </div>
      </div>

      {loading && results.length === 0 && (
        <div className="card p-8 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Searching...
        </div>
      )}

      {!loading && q && results.length === 0 && (
        <EmptyState
          message="No articles found"
          subMessage={`No results for "${q}". Try different keywords or visit a feed to cache more articles.`}
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
          subMessage="Search across cached article titles, descriptions, summaries, and tags. Connect the backend API for expanded results across the full article archive."
        />
      )}
    </div>
  );
}
