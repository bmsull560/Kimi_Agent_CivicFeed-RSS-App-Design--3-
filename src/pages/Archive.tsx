import { Archive as ArchiveIcon } from "lucide-react";
import { useFeedCache } from "../hooks/useFeedCache";
import { useUserFeeds } from "../hooks/useUserFeeds";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import { isArchived } from "../lib/userData";

export default function Archive() {
  const { enabledFeeds } = useUserFeeds();
  const { allCached } = useFeedCache();
  const enabledIds = new Set(enabledFeeds.map(f => f.id));
  const cached = allCached(true);

  const entries = cached
    .filter(c => enabledIds.has(c.feedId))
    .flatMap(c => c.entries)
    .filter(e => isArchived(e.id))
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArchiveIcon size={22} className="text-slate-600" />
        <h1 className="text-xl font-bold text-slate-900">Archive</h1>
      </div>
      {entries.length === 0 ? (
        <EmptyState
          message="No archived articles"
          subMessage="Archive articles from the reading stream to hide them from your main feed."
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
