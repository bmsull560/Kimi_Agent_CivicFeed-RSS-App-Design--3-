import { Bookmark } from "lucide-react";
import { useFeedCache } from "../hooks/useFeedCache";
import { useUserFeeds } from "../hooks/useUserFeeds";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import { isBookmarked } from "../lib/userData";

export default function Bookmarks() {
  const { enabledFeeds } = useUserFeeds();
  const { allCached } = useFeedCache();
  const enabledIds = new Set(enabledFeeds.map(f => f.id));
  const cached = allCached(true);

  const entries = cached
    .filter(c => enabledIds.has(c.feedId))
    .flatMap(c => c.entries)
    .filter(e => isBookmarked(e.id))
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bookmark size={22} className="text-amber-500" />
        <h1 className="text-xl font-bold text-slate-900">Bookmarks</h1>
      </div>
      {entries.length === 0 ? (
        <EmptyState
          message="No bookmarks yet"
          subMessage="Bookmark articles from the reading stream or feed detail to save them here."
        />
      ) : (
        <div className="card divide-y divide-slate-100 px-5">
          {entries.map(entry => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
