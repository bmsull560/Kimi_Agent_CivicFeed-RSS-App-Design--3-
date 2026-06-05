import type { RssEntry } from "../types";

function timeAgo(isoDate: string): string {
  const d = new Date(isoDate);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

interface EntryCardProps { entry: RssEntry; compact?: boolean; }

export default function EntryCard({ entry, compact }: EntryCardProps) {
  const cleanDesc = stripHtml(entry.description).trim();
  const shortDesc = cleanDesc.length > 200 ? cleanDesc.slice(0, 200) + "..." : cleanDesc;
  return (
    <article className={`group border-b border-slate-100 ${compact ? "py-3" : "py-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a href={entry.link} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
            {entry.title || "Untitled"}
          </a>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge bg-slate-100 text-slate-600">{entry.feedName}</span>
            {entry.author && <span className="text-[0.6875rem] text-slate-500">{entry.author}</span>}
            <span className="text-[0.6875rem] text-slate-400">{timeAgo(entry.pubDate)}</span>
          </div>
          {!compact && shortDesc && <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">{shortDesc}</p>}
        </div>
      </div>
    </article>
  );
}
