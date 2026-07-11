import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Newspaper } from "lucide-react";
import { useUserFeeds } from "../hooks/useUserFeeds";
import { useFeedCache } from "../hooks/useFeedCache";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import type { RssEntry } from "../types";
import { isRead, isBookmarked, isArchived } from "../lib/userData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ReadingStream() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { enabledFeeds } = useUserFeeds();
  const { allCached } = useFeedCache();
  const [tick, setTick] = useState(0);

  const enabledIds = useMemo(() => new Set(enabledFeeds.map(f => f.id)), [enabledFeeds]);
  const cached = allCached(true);

  const queryParam = searchParams.get("q") || "";
  const sourceParam = searchParams.get("source") || "";
  const statusParam = searchParams.get("status") || "";

  const [query, setQuery] = useState(queryParam);

  const allEntries = useMemo(() => {
    const entries: RssEntry[] = [];
    for (const cache of cached) {
      if (!enabledIds.has(cache.feedId)) continue;
      for (const entry of cache.entries) {
        entries.push(entry);
      }
    }
    return entries.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  }, [cached, enabledIds]);

  const filteredEntries = useMemo(() => {
    let result = allEntries;
    if (queryParam) {
      const lower = queryParam.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(lower) ||
        e.description.toLowerCase().includes(lower) ||
        e.feedName.toLowerCase().includes(lower)
      );
    }
    if (sourceParam) {
      result = result.filter(e => e.feedId === sourceParam);
    }
    switch (statusParam) {
      case "unread":
        result = result.filter(e => !isRead(e.id));
        break;
      case "read":
        result = result.filter(e => isRead(e.id));
        break;
      case "bookmarked":
        result = result.filter(e => isBookmarked(e.id));
        break;
      case "archived":
        result = result.filter(e => isArchived(e.id));
        break;
    }
    return result;
  }, [allEntries, queryParam, sourceParam, statusParam]);

  const applyFilters = () => {
    const p = new URLSearchParams(searchParams);
    if (query) p.set("q", query);
    else p.delete("q");
    setSearchParams(p);
  };

  const clearFilters = () => {
    setQuery("");
    setSearchParams(new URLSearchParams());
  };

  const handleSourceChange = (value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value && value !== "__all__") p.set("source", value);
    else p.delete("source");
    setSearchParams(p);
  };

  const handleStatusChange = (value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value && value !== "__all__") p.set("status", value);
    else p.delete("status");
    setSearchParams(p);
  };

  const refresh = () => setTick(t => t + 1);

  return (
    <div className="space-y-4" key={tick}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Newspaper size={22} className="text-blue-600" /> Reading Stream
          </h1>
          <p className="text-sm text-slate-500">{filteredEntries.length} article{filteredEntries.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Search articles..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applyFilters()}
              className="w-48"
            />
            <Button type="button" variant="outline" onClick={applyFilters}>Search</Button>
          </div>
          <Select value={sourceParam || "__all__"} onValueChange={handleSourceChange}>
            <SelectTrigger className="w-44" aria-label="Filter by source">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All sources</SelectItem>
              {enabledFeeds.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.shortName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusParam || "__all__"} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue placeholder="All articles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All articles</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="bookmarked">Bookmarked</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          {(queryParam || sourceParam || statusParam) && (
            <Button type="button" variant="ghost" onClick={clearFilters}>Clear</Button>
          )}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState
          message="No articles found"
          subMessage={allEntries.length === 0 ? "Visit a feed to load articles, then return here." : "Try adjusting your filters."}
          action={{ label: "Browse Feeds", onClick: () => window.location.hash = "#/feeds" }}
        />
      ) : (
        <div className="card divide-y divide-slate-100 px-5">
          {filteredEntries.map(entry => (
            <EntryCard key={entry.id} entry={entry} onChange={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
