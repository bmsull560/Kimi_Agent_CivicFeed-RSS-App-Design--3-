import { useNavigate } from "react-router-dom";
import { Bookmark, BookmarkCheck, Archive, ArchiveRestore, Eye, EyeOff, ExternalLink } from "lucide-react";
import type { RssEntry } from "../types";
import { isBookmarked, isRead, isArchived, toggleBookmark, toggleRead, toggleArchived, markRead } from "../lib/userData";

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

function sourceLabel(source?: string): string {
  if (source === "ollama") return "AI";
  if (source === "openai") return "AI";
  if (source === "extractive") return "Summary";
  return "";
}

function sourceColor(source?: string): string {
  if (source === "ollama" || source === "openai") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export interface EntryCardProps {
  entry: RssEntry;
  compact?: boolean;
  onChange?: () => void;
}

export default function EntryCard({ entry, compact, onChange }: EntryCardProps) {
  const navigate = useNavigate();
  const cleanDesc = stripHtml(entry.description).trim();
  const shortDesc = cleanDesc.length > 200 ? cleanDesc.slice(0, 200) + "..." : cleanDesc;
  const hasAiSummary = !!entry.aiSummary && entry.aiSummary.length > 10;
  const read = isRead(entry.id);
  const bookmarked = isBookmarked(entry.id);
  const archived = isArchived(entry.id);

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleRead(entry.id);
    onChange?.();
  };

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark(entry.id);
    onChange?.();
  };

  const handleToggleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleArchived(entry.id);
    onChange?.();
  };

  const handleOpenDetail = () => {
    markRead(entry.id);
    navigate(`/entry/${entry.feedId}/${encodeURIComponent(entry.id)}`);
    onChange?.();
  };

  return (
    <article className={`group border-b border-slate-100 ${compact ? "py-3" : "py-4"} ${read ? "bg-slate-50/50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <button onClick={handleOpenDetail} className="min-w-0 flex-1 text-left" type="button">
          <span className="block text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
            {entry.title || "Untitled"}
          </span>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="badge bg-slate-100 text-slate-600">{entry.feedName}</span>
            {entry.author && <span className="text-[0.6875rem] text-slate-500">{entry.author}</span>}
            <span className="text-[0.6875rem] text-slate-400">{timeAgo(entry.pubDate)}</span>
            {read && <span className="text-[0.6875rem] text-blue-600">Read</span>}
          </div>

          {hasAiSummary && (
            <div className={`mt-2 text-sm leading-relaxed rounded-md px-3 py-2 border ${sourceColor(entry.aiSummarySource)}`}>
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider opacity-70 mr-1">
                {sourceLabel(entry.aiSummarySource)}
              </span>
              {entry.aiSummary}
            </div>
          )}

          {entry.aiTags && entry.aiTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.aiTags.map((tag) => (
                <span key={tag} className="text-[0.65rem] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {!compact && !hasAiSummary && shortDesc && (
            <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">{shortDesc}</p>
          )}
        </button>

        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleToggleBookmark}
            className={`p-1.5 rounded-md transition-colors ${bookmarked ? "text-amber-500 bg-amber-50" : "text-slate-400 hover:text-amber-500 hover:bg-slate-100"}`}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
            title={bookmarked ? "Bookmarked" : "Bookmark"}
          >
            {bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
          <button
            type="button"
            onClick={handleToggleRead}
            className={`p-1.5 rounded-md transition-colors ${read ? "text-blue-500 bg-blue-50" : "text-slate-400 hover:text-blue-500 hover:bg-slate-100"}`}
            aria-label={read ? "Mark unread" : "Mark read"}
            title={read ? "Mark unread" : "Mark read"}
          >
            {read ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            type="button"
            onClick={handleToggleArchive}
            className={`p-1.5 rounded-md transition-colors ${archived ? "text-slate-700 bg-slate-200" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}
            aria-label={archived ? "Unarchive" : "Archive"}
            title={archived ? "Archived" : "Archive"}
          >
            {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Open original article"
            title="Open original article"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </article>
  );
}
