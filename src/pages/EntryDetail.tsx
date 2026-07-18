import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Eye,
  EyeOff,
  Archive,
  ArchiveRestore,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useUserFeeds } from "../hooks/useUserFeeds";
import { useRssFeed } from "../hooks/useRssFeed";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  isBookmarked,
  isRead,
  isArchived,
  toggleBookmark,
  toggleRead,
  toggleArchived,
  markRead,
} from "../lib/userData";

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function estimateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default function EntryDetail() {
  const { feedId, entryId } = useParams<{ feedId: string; entryId: string }>();
  const navigate = useNavigate();
  const { allFeeds } = useUserFeeds();
  const feed = feedId ? allFeeds.find((f) => f.id === feedId) : undefined;
  const { status, entries, error } = useRssFeed(feed?.rssUrl || "", feed?.id || "");
  const contentRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const decodedEntryId = entryId ? decodeURIComponent(entryId) : "";
  const entry = entries.find((e) => e.id === decodedEntryId);

  useEffect(() => {
    if (entry) markRead(entry.id);
  }, [entry]);

  useEffect(() => {
    function handleScroll() {
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrolled = Math.max(0, -rect.top);
      const total = rect.height - window.innerHeight;
      const ratio = total > 0 ? Math.min(1, scrolled / total) : 1;
      setProgress(ratio);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (speaking) window.speechSynthesis.cancel();
    };
  }, [speaking]);

  if (!feed) {
    return (
      <EmptyState
        message="Feed not found"
        subMessage={`No feed exists with ID "${feedId}".`}
        action={{ label: "Back to Directory", onClick: () => navigate("/feeds") }}
      />
    );
  }

  if (status === "loading" && entries.length === 0) {
    return <LoadingState count={5} type="list-item" />;
  }

  if (!entry) {
    return (
      <EmptyState
        message="Article not found"
        subMessage="The article may have been removed or the feed has not loaded yet."
        action={{ label: "Back to Feed", onClick: () => navigate(`/feed/${feed.id}`) }}
      />
    );
  }

  const bookmarked = isBookmarked(entry.id);
  const read = isRead(entry.id);
  const archived = isArchived(entry.id);
  const hasAiSummary = !!entry.aiSummary && entry.aiSummary.length > 10;
  const cleanContent = stripHtml(entry.description);
  const readTime = estimateReadTime(cleanContent);

  const handleSpeak = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = hasAiSummary
      ? `${entry.title}. ${entry.aiSummary} ${cleanContent}`
      : `${entry.title}. ${cleanContent}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <>
      {/* Reading progress bar */}
      <div className="fixed top-14 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 z-40">
        <div
          className="h-full bg-blue-600 transition-all duration-150"
          style={{ width: `${progress * 100}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="max-w-[650px] mx-auto pb-24">
        <div className="flex items-center gap-2 mb-6">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </Button>
        </div>

        <article>
          <header className="mb-6">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
              {entry.feedName}
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {entry.title || "Untitled"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-slate-500 dark:text-slate-400 font-sans">
              {entry.author && <span>By {entry.author}</span>}
              <span>{formatDate(entry.pubDate)}</span>
              <span>{readTime} min read</span>
            </div>
          </header>

          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              type="button"
              variant={bookmarked ? "default" : "outline"}
              size="sm"
              onClick={() => toggleBookmark(entry.id)}
            >
              {bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {bookmarked ? "Bookmarked" : "Bookmark"}
            </Button>
            <Button
              type="button"
              variant={read ? "default" : "outline"}
              size="sm"
              onClick={() => toggleRead(entry.id)}
            >
              {read ? <EyeOff size={16} /> : <Eye size={16} />}
              {read ? "Mark unread" : "Mark read"}
            </Button>
            <Button
              type="button"
              variant={archived ? "default" : "outline"}
              size="sm"
              onClick={() => toggleArchived(entry.id)}
            >
              {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              {archived ? "Unarchive" : "Archive"}
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={entry.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} /> Original source
              </a>
            </Button>
          </div>

          {error && entries.length > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-md mb-6">
              Showing cached article. Refresh failed: {error}
            </p>
          )}

          {hasAiSummary && (
            <Card className="p-4 mb-8 border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                  AI TL;DR
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {entry.aiSummary}
              </p>
            </Card>
          )}

          <div
            ref={contentRef}
            className="prose prose-slate dark:prose-invert max-w-none font-serif text-slate-800 dark:text-slate-200 leading-[1.65]"
          >
            <p className="whitespace-pre-line">{cleanContent}</p>
          </div>
        </article>
      </div>

      {/* TTS controller */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 z-30">
        <div className="max-w-[650px] mx-auto flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
              {entry.title || "Untitled"}
            </p>
            <p className="text-[0.6875rem] text-slate-500 dark:text-slate-400">
              {speaking ? "Playing narration…" : "Ready to narrate"}
            </p>
          </div>
          <Button
            type="button"
            variant={speaking ? "default" : "outline"}
            size="sm"
            onClick={handleSpeak}
          >
            {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
            {speaking ? "Stop" : "Listen"}
          </Button>
        </div>
      </div>
    </>
  );
}
