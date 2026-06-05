import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, Globe, Shield, Heart, Leaf, Landmark, Scale, Briefcase, Store,
  Train, AlertTriangle, Palette, Eye, FileText, Star, Newspaper, BookOpen, Sprout,
  Cpu, Home, HeartPulse, RefreshCw, ArrowRight, Rss, CheckCircle2, XCircle,
} from "lucide-react";
import { feedStats, categoryList } from "../data/feeds";
import { useFeedCache } from "../hooks/useFeedCache";
import { loadFeedHealth, getHealthCounts } from "../lib/health";
import type { FeedHealth } from "../types";
import CategoryCard from "../components/CategoryCard";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const byCategory = feedStats.byCategory as Record<string, number>;

const categoryIcons: Record<string, React.ReactNode> = {
  "Oversight & Audits": <Eye size={20} />,
  "Courts & Judiciary": <Scale size={20} />,
  "Finance & Economy": <TrendingUp size={20} />,
  "Environment & Energy": <Leaf size={20} />,
  "Health & Science": <Heart size={20} />,
  "Congress & Legislation": <Landmark size={20} />,
  "Defense & Security": <Shield size={20} />,
  "General": <Newspaper size={20} />,
  "Diplomacy & Foreign Affairs": <Globe size={20} />,
  "Grants & Arts": <Palette size={20} />,
  "Labor & Employment": <Briefcase size={20} />,
  "Safety & Consumer Protection": <AlertTriangle size={20} />,
  "Commerce & Trade": <Store size={20} />,
  "Rulemaking & Regulations": <FileText size={20} />,
  "Development & Education": <BookOpen size={20} />,
  "Executive & Press": <Star size={20} />,
  "Transportation": <Train size={20} />,
  "Agriculture & Food": <Sprout size={20} />,
  "Technology, Cybersecurity, & Space": <Cpu size={20} />,
  "Housing, Urban Development, & Infrastructure": <Home size={20} />,
  "Veterans Affairs, Healthcare, & Benefits": <HeartPulse size={20} />,
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { allCached, clearAll, stats } = useFeedCache();
  const cachedData = allCached();
  const cacheStats = stats();
  const [healthData, setHealthData] = useState<FeedHealth[]>([]);

  useEffect(() => {
    loadFeedHealth().then(setHealthData);
  }, []);

  const healthCounts = getHealthCounts(healthData);

  const handleRefreshAll = () => { clearAll(); window.location.reload(); };

  const recentEntries = cachedData
    .flatMap(c => c.entries.slice(0, 3).map(e => ({ ...e, _feedId: c.feedId })))
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">U.S. Government RSS Feeds</h1>
            <p className="text-sm text-slate-500 mt-1">{feedStats.total} feeds across {Object.keys(feedStats.byCategory).length} categories from federal agencies</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefreshAll} className="btn-secondary" type="button" title="Clear cache and reload"><RefreshCw size={16} /> Refresh All</button>
            <button onClick={() => navigate("/feeds")} className="btn-primary" type="button">Browse All <ArrowRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-blue-600">{feedStats.total}</p><p className="text-[0.6875rem] text-slate-500 uppercase tracking-wide">Total Feeds</p></div>
          <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-blue-600">{Object.keys(feedStats.byCategory).length}</p><p className="text-[0.6875rem] text-slate-500 uppercase tracking-wide">Categories</p></div>
          <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-blue-600">{cachedData.length}</p><p className="text-[0.6875rem] text-slate-500 uppercase tracking-wide">Cached</p></div>
          <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-blue-600">{cacheStats.oldestFetch ? formatRelativeTime(cacheStats.oldestFetch) : "—"}</p><p className="text-[0.6875rem] text-slate-500 uppercase tracking-wide">Last Update</p></div>
        </div>
      </section>

      {healthData.length > 0 && (
        <section className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Feed Health Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 bg-green-50 rounded-lg p-4">
              <CheckCircle2 size={24} className="text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">{healthCounts.ok}</p>
                <p className="text-sm text-green-600">Healthy</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-amber-50 rounded-lg p-4">
              <AlertTriangle size={24} className="text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700">{healthCounts.warn}</p>
                <p className="text-sm text-amber-600">Warning</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-red-50 rounded-lg p-4">
              <XCircle size={24} className="text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700">{healthCounts.fail}</p>
                <p className="text-sm text-red-600">Failed</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Browse by Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {categoryList.map(cat => (
            <CategoryCard key={cat} category={cat} count={byCategory[cat] || 0} icon={categoryIcons[cat] || <Rss size={20} />}
              onClick={() => navigate(`/feeds?category=${encodeURIComponent(cat)}`)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Entries</h2>
        {recentEntries.length > 0 ? (
          <div className="card divide-y divide-slate-100 px-5">
            {recentEntries.map(entry => <EntryCard key={entry.id} entry={entry} compact />)}
          </div>
        ) : (
          <div className="card">
            <EmptyState message="No cached entries yet" subMessage="Visit a feed to load entries. They'll be cached locally for quick access."
              action={{ label: "Browse Feeds", onClick: () => navigate("/feeds") }} />
          </div>
        )}
      </section>
    </div>
  );
}
