import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Bookmark, BookmarkCheck, Eye, EyeOff, Archive, ArchiveRestore } from "lucide-react";
import { useUserFeeds } from "../hooks/useUserFeeds";
import { useRssFeed } from "../hooks/useRssFeed";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import { isBookmarked, isRead, isArchived, toggleBookmark, toggleRead, toggleArchived, markRead } from "../lib/userData";
import { Button } from "@/components/ui/button";

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleString();
}

export default function EntryDetail() {
  const { feedId, entryId } = useParams<{ feedId: string; entryId: string }>();
  const navigate = useNavigate();
  const { allFeeds } = useUserFeeds();
  const feed = feedId ? allFeeds.find(f => f.id === feedId) : undefined;
  const { status, entries, error } = useRssFeed(feed?.rssUrl || "", feed?.id || "", feed?.shortName || "");

  const decodedEntryId = entryId ? decodeURIComponent(entryId) : "";
  const entry = entries.find(e => e.id === decodedEntryId) ||
    (feedId ? undefined : undefined);

  // Mark as read when detail opens
  if (entry) {
    markRead(entry.id);
  }

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

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </Button>
      </div>

      <article className="card p-6 space-y-4">
        <header className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">{entry.title || "Untitled"}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="badge bg-slate-100 text-slate-700">{entry.feedName}</span>
            {entry.author && <span>By {entry.author}</span>}
            <span>{formatDate(entry.pubDate)}</span>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
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
          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-md">Showing cached article. Refresh failed: {error}</p>
        )}

        <div className="prose prose-slate max-w-none">
          <p className="text-slate-700 leading-relaxed whitespace-pre-line">{stripHtml(entry.description)}</p>
        </div>
      </article>
    </div>
  );
}
