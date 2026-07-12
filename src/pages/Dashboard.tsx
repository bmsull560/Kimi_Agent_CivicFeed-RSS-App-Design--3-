import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Globe,
  Shield,
  Heart,
  Leaf,
  Landmark,
  Scale,
  Briefcase,
  Store,
  Train,
  AlertTriangle,
  Palette,
  Eye,
  FileText,
  Star,
  Newspaper,
  Sprout,
  Cpu,
  Home,
  HeartPulse,
  RefreshCw,
  ArrowRight,
  Rss,
} from "lucide-react";
import { useUserFeeds } from "../hooks/useUserFeeds";
import CategoryCard from "../components/CategoryCard";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import type { RssEntry, SearchResultItem } from "../types";

const categoryIcons: Record<string, React.ReactNode> = {
  "Oversight & Audits": <Eye size={20} />,
  "Courts & Judiciary": <Scale size={20} />,
  "Finance & Economy": <TrendingUp size={20} />,
  "Environment & Energy": <Leaf size={20} />,
  "Health & Science": <Heart size={20} />,
  "Congress & Legislation": <Landmark size={20} />,
  "Defense & Security": <Shield size={20} />,
  General: <Newspaper size={20} />,
  "Diplomacy & Foreign Affairs": <Globe size={20} />,
  "Grants & Arts": <Palette size={20} />,
  "Labor & Employment": <Briefcase size={20} />,
  "Safety & Consumer Protection": <AlertTriangle size={20} />,
  "Commerce & Trade": <Store size={20} />,
  "Rulemaking & Regulations": <FileText size={20} />,
  "Executive & Press": <Star size={20} />,
  Transportation: <Train size={20} />,
  "Agriculture & Food": <Sprout size={20} />,
  "Technology, Cybersecurity, & Space": <Cpu size={20} />,
  "Housing, Urban Development, & Infrastructure": <Home size={20} />,
  "Veterans Affairs, Healthcare, & Benefits": <HeartPulse size={20} />,
};

function toRssEntry(r: SearchResultItem): RssEntry {
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { allFeeds, enabledFeeds, catalogLoading, catalogError, refresh } = useUserFeeds();
  const [recentEntries, setRecentEntries] = useState<RssEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setRecentLoading(true);
      try {
        const apiBase = import.meta.env?.VITE_API_URL || "";
        const candidates = new Set<string>([apiBase]);
        if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
          candidates.add("http://localhost:4000");
        }

        for (const base of candidates) {
          try {
            const res = await fetch(`${base}/api/articles/recent?limit=50`, {
              signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) continue;
            const data = (await res.json()) as { results?: SearchResultItem[] };
            setRecentEntries((data.results || []).map(toRssEntry));
            return;
          } catch {
            // try next candidate
          }
        }
      } finally {
        setRecentLoading(false);
      }
    };

    void load();
  }, []);

  const enabledIds = useMemo(() => new Set(enabledFeeds.map((f) => f.id)), [enabledFeeds]);
  const visibleRecent = recentEntries.filter((e) => enabledIds.has(e.feedId)).slice(0, 10);

  const byCategory: Record<string, number> = {};
  for (const feed of enabledFeeds) {
    byCategory[feed.category] = (byCategory[feed.category] || 0) + 1;
  }
  const categoryList = Object.keys(byCategory).sort();

  const tierOneFeeds = enabledFeeds.filter((f) => f.priority === 1).slice(0, 6);

  const handleRefreshAll = () => {
    refresh();
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">U.S. Government RSS Feeds</h1>
            <p className="text-sm text-slate-500 mt-1">
              {allFeeds.length} feeds across {categoryList.length} categories
              {enabledFeeds.length !== allFeeds.length && ` (${enabledFeeds.length} enabled)`}
            </p>
            {catalogError && <p className="text-sm text-amber-700 mt-1">{catalogError}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshAll}
              className="btn-secondary"
              type="button"
              title="Reload page and refresh catalog"
            >
              <RefreshCw size={16} /> Refresh All
            </button>
            <button onClick={() => navigate("/feeds")} className="btn-primary" type="button">
              Browse All <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{allFeeds.length}</p>
            <p className="text-[0.6875rem] text-slate-500 uppercase tracking-wide">Total Feeds</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{categoryList.length}</p>
            <p className="text-[0.6875rem] text-slate-500 uppercase tracking-wide">Categories</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{visibleRecent.length}</p>
            <p className="text-[0.6875rem] text-slate-500 uppercase tracking-wide">Recent</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{catalogLoading ? "—" : "Live"}</p>
            <p className="text-[0.6875rem] text-slate-500 uppercase tracking-wide">Catalog</p>
          </div>
        </div>
      </section>

      {/* Critical Alerts — Tier 1 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={20} />
            Critical Alerts — Tier 1
          </h2>
          <button
            onClick={() => navigate("/feeds?priority=1")}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View all Tier 1 →
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tierOneFeeds.map((feed) => (
            <button
              key={feed.id}
              onClick={() => navigate(`/feed/${feed.id}`)}
              className="card card-hover cursor-pointer p-4 text-left"
              type="button"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{feed.shortName}</h3>
                  <p className="text-xs text-slate-500 mt-1">{feed.agency}</p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-medium bg-red-50 text-red-700">
                  Tier 1
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 line-clamp-2">{feed.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Browse by Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {categoryList.map((cat) => (
            <CategoryCard
              key={cat}
              category={cat}
              count={byCategory[cat] || 0}
              icon={categoryIcons[cat] || <Rss size={20} />}
              onClick={() => navigate(`/feeds?category=${encodeURIComponent(cat)}`)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Entries</h2>
        {recentLoading ? (
          <p className="text-sm text-slate-500">Loading recent entries…</p>
        ) : visibleRecent.length > 0 ? (
          <div className="card divide-y divide-slate-100 px-5">
            {visibleRecent.map((entry) => (
              <EntryCard key={entry.id} entry={entry} compact />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              message="No recent entries yet"
              subMessage="Visit a feed to load entries from the backend cache."
              action={{ label: "Browse Feeds", onClick: () => navigate("/feeds") }}
            />
          </div>
        )}
      </section>
    </div>
  );
}
