import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Newspaper, Tag, ArrowRight, Loader2 } from "lucide-react";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import type { RssEntry } from "../types";

interface RecapGroup {
  category: string;
  entries: RecapEntry[];
}

interface RecapEntry {
  entryId: string;
  feedId: string;
  feedName: string;
  feedCategory: string;
  title: string;
  link: string;
  pubDate: string;
  author: string | null;
  aiSummary?: string;
  aiTags?: string[];
}

interface WeeklyRecap {
  startDate: string;
  endDate: string;
  totalArticles: number;
  categories: RecapGroup[];
  topTags: { tag: string; count: number }[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Recap() {
  const navigate = useNavigate();
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/recap")
      .then((r) => r.json())
      .then((data) => {
        setRecap(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  const toEntry = (r: RecapEntry): RssEntry => ({
    id: r.entryId,
    title: r.title,
    link: r.link,
    description: "",
    pubDate: r.pubDate,
    author: r.author || undefined,
    feedId: r.feedId,
    feedName: r.feedName,
    fetchedAt: Date.now(),
    aiSummary: r.aiSummary,
    aiTags: r.aiTags,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Weekly Recap</h1>
          {recap && (
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
              <Calendar size={13} />
              {formatDate(recap.startDate)} – {formatDate(recap.endDate)}
            </p>
          )}
        </div>
        {recap && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Newspaper size={14} /> {recap.totalArticles} articles</span>
            <span className="flex items-center gap-1"><Tag size={14} /> {recap.topTags.length} topics</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="card p-8 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Generating recap...
        </div>
      )}

      {error && <div className="card p-6 text-red-600">{error}</div>}

      {!loading && recap && recap.totalArticles === 0 && (
        <EmptyState
          message="No articles this week"
          subMessage="Visit some feeds to build up article cache, then check back."
          action={{ label: "Browse Feeds", onClick: () => navigate("/feeds") }}
        />
      )}

      {/* Top Tags */}
      {!loading && recap && recap.topTags.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
            <Tag size={14} /> Trending Topics
          </h2>
          <div className="flex flex-wrap gap-2">
            {recap.topTags.map((t) => (
              <button
                key={t.tag}
                onClick={() => navigate(`/search?q=${encodeURIComponent(t.tag)}`)}
                className="text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors"
                type="button"
              >
                {t.tag} <span className="text-blue-400 text-xs">({t.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Groups */}
      {!loading && recap && recap.categories.map((group) => (
        <section key={group.category} className="card">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">{group.category}</h2>
            <span className="text-xs text-slate-400">{group.entries.length} articles</span>
          </div>
          <div className="divide-y divide-slate-100 px-5">
            {group.entries.slice(0, 5).map((r) => (
              <EntryCard key={r.entryId} entry={toEntry(r)} compact />
            ))}
          </div>
          {group.entries.length > 5 && (
            <div className="px-5 py-2 border-t border-slate-100">
              <button
                onClick={() => navigate(`/feeds?category=${encodeURIComponent(group.category)}`)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                type="button"
              >
                View all {group.entries.length} in {group.category} <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
