import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Copy, Rss, ExternalLink, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { getFeedById } from "../data/feeds";
import { useRssFeed } from "../hooks/useRssFeed";
import { loadFeedHealth, getFeedHealth, healthStatusColor, healthStatusLabel } from "../lib/health";
import type { FeedHealth } from "../types";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";

function statusDot(status: string): string {
  switch (status) { case "working": return "bg-green-500"; case "blocked": return "bg-red-500"; default: return "bg-slate-300"; }
}
function statusLabel(status: string): string {
  switch (status) { case "working": return "Working"; case "blocked": return "Blocked"; default: return "Unverified"; }
}

const checkLabels: Record<keyof FeedHealth["checks"], string> = {
  reachable: "Reachable",
  validXml: "Valid XML",
  validSchema: "Valid Schema",
  stableGuids: "Stable GUIDs",
  saneDates: "Sane Dates",
  usableContent: "Usable Content",
  fresh: "Fresh",
};

function CheckRow({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {pass ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
      <span className={pass ? "text-slate-700" : "text-slate-500"}>{label}</span>
    </div>
  );
}

export default function FeedDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const feed = id ? getFeedById(id) : undefined;
  const { status, entries, error, refresh } = useRssFeed(feed?.rssUrl || "", feed?.id || "", feed?.shortName || "");
  const [health, setHealth] = useState<FeedHealth | undefined>(undefined);

  useEffect(() => {
    loadFeedHealth().then(data => {
      if (feed) setHealth(getFeedHealth(data, feed.id));
    });
  }, [feed]);

  const handleCopyUrl = async () => {
    if (!feed) return;
    try { await navigator.clipboard.writeText(feed.rssUrl); } catch {
      const ta = document.createElement("textarea"); ta.value = feed.rssUrl; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
  };

  if (!feed) return <EmptyState message="Feed not found" subMessage={`No feed exists with ID "${id}".`} action={{ label: "Back to Directory", onClick: () => navigate("/feeds") }} />;

  const dotColor = health ? healthStatusColor(health.status) : statusDot(feed.status);
  const dotLabel = health ? healthStatusLabel(health.status) : statusLabel(feed.status);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2 mt-0.5 flex-shrink-0" type="button" title="Go back"><ArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 truncate">{feed.shortName}</h1>
            <span className={`w-2 h-2 rounded-full ${dotColor}`} title={dotLabel} />
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

      {health && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            {health.status === "ok" ? <CheckCircle2 size={16} className="text-green-500" /> : health.status === "warn" ? <AlertTriangle size={16} className="text-amber-500" /> : <XCircle size={16} className="text-red-500" />}
            <h2 className="text-sm font-semibold text-slate-800">Feed Health — {healthStatusLabel(health.status)}</h2>
            {health.newestItemDate && (
              <span className="text-[0.6875rem] text-slate-400 ml-auto">Newest item: {new Date(health.newestItemDate).toLocaleDateString()}</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(checkLabels) as Array<keyof typeof checkLabels>).map(key => (
              <CheckRow key={key} label={checkLabels[key]} pass={health.checks[key]} />
            ))}
          </div>
          {health.error && <p className="text-xs text-red-600 mt-2">{health.error}</p>}
          <p className="text-[0.6875rem] text-slate-400 mt-2">Validated in {health.responseTimeMs}ms</p>
        </div>
      )}

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
