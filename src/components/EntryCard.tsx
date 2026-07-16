import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  BookmarkCheck,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  ExternalLink,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RssEntry } from "../types";
import {
  isBookmarked,
  isRead,
  isArchived,
  toggleBookmark,
  toggleRead,
  toggleArchived,
  markRead,
} from "../lib/userData";

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

function estimateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function sourceLabel(source?: string): string {
  if (source === "ollama" || source === "openai") return "AI summary";
  if (source === "extractive") return "Summary";
  return "Summary";
}

export interface EntryCardProps {
  entry: RssEntry;
  compact?: boolean;
  onChange?: () => void;
}

export default function EntryCard({ entry, compact, onChange }: EntryCardProps) {
  const navigate = useNavigate();
  const [bookmarkPulse, setBookmarkPulse] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const cleanDesc = stripHtml(entry.description).trim();
  const shortDesc = cleanDesc.length > 200 ? cleanDesc.slice(0, 200) + "…" : cleanDesc;
  const hasAiSummary = !!entry.aiSummary && entry.aiSummary.length > 10;
  const read = isRead(entry.id);
  const bookmarked = isBookmarked(entry.id);
  const archived = isArchived(entry.id);

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!bookmarked) setBookmarkPulse(true);
    toggleBookmark(entry.id);
    onChange?.();
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleRead(entry.id);
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

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = hasAiSummary
      ? `${entry.title}. ${entry.aiSummary}`
      : `${entry.title}. ${cleanDesc}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <Card
      className={`p-0 overflow-hidden ${compact ? "py-4 px-5" : "p-5"} ${
        read ? "bg-slate-50/50 dark:bg-slate-900/30" : ""
      }`}
    >
      <article className="group flex items-start gap-4">
        <button onClick={handleOpenDetail} className="min-w-0 flex-1 text-left" type="button">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {entry.feedName}
          </span>
          <h3
            className={`font-serif font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${
              compact ? "text-base leading-snug" : "text-lg leading-snug"
            }`}
          >
            {entry.title || "Untitled"}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-sans">
            {entry.author && <span>By {entry.author}</span>}
            <span>{timeAgo(entry.pubDate)}</span>
            <span>{estimateReadTime(cleanDesc)} min read</span>
            {read && <span className="text-blue-600 dark:text-blue-400">Read</span>}
          </div>

          {hasAiSummary && (
            <div className="mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSummary((s) => !s);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-full px-2.5 py-1 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                type="button"
                aria-expanded={showSummary}
              >
                <Sparkles size={12} />
                {sourceLabel(entry.aiSummarySource)}
                {showSummary ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showSummary && (
                <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg px-3 py-2 border border-emerald-100 dark:border-emerald-900/50">
                  {entry.aiSummary}
                </div>
              )}
            </div>
          )}

          {!compact && !hasAiSummary && shortDesc && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
              {shortDesc}
            </p>
          )}

          {entry.aiTags && entry.aiTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {entry.aiTags.slice(0, compact ? 3 : 6).map((tag) => (
                <span
                  key={tag}
                  className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </button>

        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleBookmark}
            onAnimationEnd={() => setBookmarkPulse(false)}
            className={`size-8 ${bookmarkPulse ? "animate-bookmark-pop" : ""} ${
              bookmarked
                ? "text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                : "text-slate-400 hover:text-blue-600"
            }`}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
            title={bookmarked ? "Bookmarked" : "Bookmark"}
          >
            {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleRead}
            className={`size-8 ${read ? "text-blue-600 bg-blue-50 dark:bg-blue-950/40" : "text-slate-400 hover:text-blue-600"}`}
            aria-label={read ? "Mark unread" : "Mark read"}
            title={read ? "Mark unread" : "Mark read"}
          >
            {read ? <EyeOff size={18} /> : <Eye size={18} />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleArchive}
            className={`size-8 ${archived ? "text-slate-700 bg-slate-200 dark:bg-slate-700" : "text-slate-400 hover:text-slate-700"}`}
            aria-label={archived ? "Unarchive" : "Archive"}
            title={archived ? "Archived" : "Archive"}
          >
            {archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSpeak}
            className={`size-8 ${speaking ? "text-blue-600 bg-blue-50 dark:bg-blue-950/40" : "text-slate-400 hover:text-blue-600"}`}
            aria-label={speaking ? "Stop narration" : "Listen to summary"}
            title={speaking ? "Stop narration" : "Listen to summary"}
          >
            {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center size-8 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-ring"
            aria-label="Open original article"
            title="Open original article"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </article>
    </Card>
  );
}
