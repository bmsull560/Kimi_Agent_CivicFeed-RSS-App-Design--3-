import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, LayoutGrid, List, Rss, ExternalLink } from "lucide-react";
import { feeds, searchFeeds, getFeedsByCategory } from "../data/feeds";
import EmptyState from "../components/EmptyState";

function statusDot(status: string): string {
  switch (status) { case "working": return "bg-green-500"; case "blocked": return "bg-red-500"; default: return "bg-slate-300"; }
}

export default function FeedDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryParam = searchParams.get("category") || "";
  const qParam = searchParams.get("q") || "";
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [localQ, setLocalQ] = useState(qParam);

  const filteredFeeds = useMemo(() => {
    let result = categoryParam ? getFeedsByCategory(categoryParam) : feeds;
    if (qParam) result = searchFeeds(qParam).filter(f => categoryParam ? f.category === categoryParam : true);
    return result;
  }, [categoryParam, qParam]);

  const handleSearch = () => { const p = new URLSearchParams(searchParams); if (localQ) p.set("q", localQ); else p.delete("q"); setSearchParams(p); };
  const clearSearch = () => { setLocalQ(""); const p = new URLSearchParams(searchParams); p.delete("q"); setSearchParams(p); };
  const clearCategory = () => { const p = new URLSearchParams(searchParams); p.delete("category"); setSearchParams(p); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{categoryParam || "All Feeds"}</h1>
          <p className="text-sm text-slate-500">{filteredFeeds.length} feed{filteredFeeds.length !== 1 ? "s" : ""}{categoryParam && <button onClick={clearCategory} className="ml-2 text-blue-600 hover:underline text-xs" type="button">Clear filter</button>}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={localQ} onChange={e => setLocalQ(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} placeholder="Search..." className="input pl-8 pr-16 py-1.5 text-sm w-52" />
            {localQ && <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-[0.6875rem] text-slate-400 hover:text-slate-600" type="button">Clear</button>}
          </div>
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("list")} className={`p-1.5 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`} type="button" aria-label="List view"><List size={16} /></button>
            <button onClick={() => setViewMode("grid")} className={`p-1.5 ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`} type="button" aria-label="Grid view"><LayoutGrid size={16} /></button>
          </div>
        </div>
      </div>

      {filteredFeeds.length === 0 ? (
        <EmptyState message="No feeds found" subMessage="Try adjusting your search or category filter." action={{ label: "Clear Filters", onClick: () => { clearSearch(); clearCategory(); } }} />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFeeds.map(feed => (
            <button key={feed.id} onClick={() => navigate(`/feed/${feed.id}`)} className="card-hover p-4 text-left cursor-pointer" type="button">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${statusDot(feed.status)}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">{feed.shortName}</h3>
                  <p className="text-[0.6875rem] text-slate-500 mt-0.5">{feed.agency}</p>
                  <div className="flex items-center gap-2 mt-2"><span className="badge bg-slate-100 text-slate-600">{feed.category}</span></div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {filteredFeeds.map(feed => (
            <div key={feed.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/feed/${feed.id}`)} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && navigate(`/feed/${feed.id}`)}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(feed.status)}`} title={feed.status} />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-slate-800 truncate">{feed.shortName}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[0.6875rem] text-slate-500">{feed.agency}</span>
                  <span className="badge bg-slate-100 text-slate-600">{feed.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {feed.website && <a href={feed.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Visit website"><ExternalLink size={14} /></a>}
                <span className="p-1.5 text-slate-300"><Rss size={14} /></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
