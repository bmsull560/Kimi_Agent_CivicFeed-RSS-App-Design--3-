import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Copy, Rss, ExternalLink } from "lucide-react";
import { getFeedById } from "../data/feeds";
import { useRssFeed } from "../hooks/useRssFeed";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";

function statusDot(status: string): string {
  switch (status) { case "working": return "bg-green-500"; case "blocked": return "bg-red-500"; default: return "bg-slate-300"; }
}
function statusLabel(status: string): string {
  switch (status) { case "working": return "Working"; case "blocked": return "Blocked"; default: return "Unverified"; }
}

export default function FeedDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const feed = id ? getFeedById(id) : undefined;
  const { status, entries, error, refresh } = useRssFeed(feed?.rssUrl || "", feed?.id || "", feed?.shortName || "");

  const handleCopyUrl = async () => {
    if (!feed) return;
    try { await navigator.clipboard.writeText(feed.rssUrl); } catch {
      const ta = document.createElement("textarea"); ta.value = feed.rssUrl; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
  };

  if (!feed) return <EmptyState message="Feed not found" subMessage={`No feed exists with ID "${id}".`} action={{ label: "Back to Directory", onClick: () => navigate("/feeds") }} />;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2 mt-0.5 flex-shrink-0" type="button" title="Go back"><ArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 truncate">{feed.shortName}</h1>
            <span className={`w-2 h-2 rounded-full ${statusDot(feed.status)}`} title={statusLabel(feed.status)} />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{feed.agency}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="badge bg-slate-100 text-slate-600">{feed.category}</span>
            {feed.subCategory !== feed.category && <span className="badge bg-slate-50 text-slate-500">{feed.subCategory}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={refresh} disabled={status === "loading"} className="btn-secondary disabled:opacity-50" type="button">
          <RefreshCw size={16} className={status === "loading" ? "animate-spin" : ""} /> Refresh
        </button>
        <button onClick={handleCopyUrl} className="btn-secondary" type="button"><Copy size={16} /> Copy RSS URL</button>
        {feed.website && <a href={feed.website} target="_blank" rel="noopener noreferrer" className="btn-secondary"><ExternalLink size={16} /> Website</a>}
        <a href={feed.rssUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary"><Rss size={16} /> Raw Feed</a>
      </div>

      {status === "loading" && entries.length === 0 ? <LoadingState count={5} type="list-item" /> :
       status === "error" && entries.length === 0 ? (
         <div className="card"><EmptyState message="Failed to load entries" subMessage={error || "The feed could not be fetched. This may be due to CORS restrictions or the feed being unavailable."} action={{ label: "Try Again", onClick: refresh }} /></div>
       ) : entries.length === 0 ? (
         <div className="card"><EmptyState message="No entries found" subMessage="This feed may be empty or temporarily unavailable." action={{ label: "Refresh", onClick: refresh }} /></div>
       ) : (
         <div className="card px-5">
           <div className="py-3 border-b border-slate-100 flex items-center justify-between">
             <h2 className="text-sm font-semibold text-slate-700">{entries.length} entr{entries.length === 1 ? "y" : "ies"}</h2>
             {status === "loading" && <RefreshCw size={14} className="animate-spin text-slate-400" />}
           </div>
           {entries.map(entry => <EntryCard key={entry.id} entry={entry} />)}
         </div>
       )}
    </div>
  );
}
