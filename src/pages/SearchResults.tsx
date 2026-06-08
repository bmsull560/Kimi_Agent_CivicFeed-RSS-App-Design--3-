import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
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

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data.results || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [q]);

  const toEntry = (r: SearchResultItem): RssEntry => ({
    id: r.entryId,
    title: r.title,
    link: r.link,
    description: r.description,
    pubDate: r.pubDate,
    author: r.author || undefined,
    feedId: r.feedId,
    feedName: r.feedName,
    fetchedAt: Date.now(),
    aiSummary: r.aiSummary,
    aiTags: r.aiTags,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Search size={20} className="text-slate-400" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {q ? `Search: "${q}"` : "Search Articles"}
          </h1>
          {!loading && q && (
            <p className="text-sm text-slate-500">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {loading && (
        <div className="card p-8 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Searching...
        </div>
      )}

      {error && (
        <div className="card p-6 text-red-600">{error}</div>
      )}

      {!loading && !error && q && results.length === 0 && (
        <EmptyState
          message="No articles found"
          subMessage={`No results for "${q}". Try different keywords.`}
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
          subMessage="Search across all article titles, descriptions, summaries, and tags."
        />
      )}
    </div>
  );
}
