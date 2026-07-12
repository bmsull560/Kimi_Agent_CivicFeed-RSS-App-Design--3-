import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search,
  LayoutGrid,
  List,
  ExternalLink,
  MoreVertical,
  Upload,
  Download,
} from "lucide-react";
import { useUserFeeds } from "../hooks/useUserFeeds";
import { generateOpml, parseOpml, parsedOpmlToUserFeeds } from "../lib/opml";
import { fetchFeedStats } from "../lib/rss";
import EmptyState from "../components/EmptyState";
import FeedFormDialog from "../components/FeedFormDialog";
import type { Feed, UserFeed, FeedStats } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

function statusDot(status: string): string {
  switch (status) {
    case "working":
      return "bg-green-500";
    case "blocked":
      return "bg-red-500";
    default:
      return "bg-slate-300";
  }
}

function isUserFeed(feed: Feed): feed is UserFeed {
  return feed.userAdded === true;
}

export default function FeedDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryParam = searchParams.get("category") || "";
  const qParam = searchParams.get("q") || "";
  const priorityParam = searchParams.get("priority");
  const priorityFilter = priorityParam ? parseInt(priorityParam, 10) : null;
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [localQ, setLocalQ] = useState(qParam);
  const {
    allFeeds,
    enabledFeeds,
    addFeed,
    updateFeed,
    removeFeed,
    toggleFeedEnabled,
    importFeeds,
    refresh,
  } = useUserFeeds();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedStats, setFeedStats] = useState<FeedStats | null>(null);

  useEffect(() => {
    void fetchFeedStats().then(setFeedStats);
  }, []);

  const filteredFeeds = useMemo(() => {
    let result = categoryParam
      ? allFeeds.filter((f) => f.category === categoryParam)
      : [...allFeeds];
    if (qParam) {
      const lower = qParam.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(lower) ||
          f.agency.toLowerCase().includes(lower) ||
          f.category.toLowerCase().includes(lower) ||
          f.tags.some((t) => t.toLowerCase().includes(lower))
      );
    }
    if (priorityFilter != null && !isNaN(priorityFilter)) {
      result = result.filter((f) => f.priority === priorityFilter);
    }
    return result;
  }, [allFeeds, categoryParam, qParam, priorityFilter]);

  const handleSearch = () => {
    const p = new URLSearchParams(searchParams);
    if (localQ) p.set("q", localQ);
    else p.delete("q");
    setSearchParams(p);
  };
  const clearSearch = () => {
    setLocalQ("");
    const p = new URLSearchParams(searchParams);
    p.delete("q");
    setSearchParams(p);
  };
  const clearCategory = () => {
    const p = new URLSearchParams(searchParams);
    p.delete("category");
    setSearchParams(p);
  };
  const clearPriority = () => {
    const p = new URLSearchParams(searchParams);
    p.delete("priority");
    setSearchParams(p);
  };

  const pageTitle = priorityFilter
    ? `Tier ${priorityFilter} Priority Feeds`
    : categoryParam
      ? categoryParam
      : qParam
        ? `Search: "${qParam}"`
        : "All Feeds";

  const handleExportOpml = () => {
    const xml = generateOpml(enabledFeeds);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "civicfeed-subscriptions.opml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseOpml(text);
      if (parsed.length === 0) {
        alert("No valid RSS feeds found in the OPML file.");
        return;
      }
      const imported = parsedOpmlToUserFeeds(parsed);
      importFeeds(imported);
      refresh();
      alert(`Imported ${imported.length} feed${imported.length === 1 ? "" : "s"}.`);
    } catch (err) {
      alert(`Failed to import OPML: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">
            {filteredFeeds.length} feed{filteredFeeds.length !== 1 ? "s" : ""}
            {categoryParam && (
              <button
                onClick={clearCategory}
                className="ml-2 text-blue-600 hover:underline text-xs"
                type="button"
              >
                Clear category
              </button>
            )}
            {priorityFilter != null && !isNaN(priorityFilter) && (
              <button
                onClick={clearPriority}
                className="ml-2 text-blue-600 hover:underline text-xs"
                type="button"
              >
                Clear priority
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search..."
              className="input pl-8 pr-16 py-1.5 text-sm w-52"
            />
            {localQ && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[0.6875rem] text-slate-500 hover:text-slate-700"
                type="button"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              type="button"
              aria-label="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              type="button"
              aria-label="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleImportClick}>
            <Upload size={16} /> Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".opml,.xml,text/xml"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleExportOpml}>
            <Download size={16} /> Export
          </Button>
          <FeedFormDialog mode="add" onSave={addFeed} />
        </div>
      </div>

      {feedStats && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <span className="font-medium">{feedStats.totalFeeds} feeds catalogued</span>
          <span aria-hidden="true">•</span>
          <span className="text-green-700">{feedStats.workingFeeds} working</span>
          {feedStats.feedsWithRecentError > 0 && (
            <span className="text-amber-700">
              {feedStats.feedsWithRecentError} with recent errors
            </span>
          )}
          {feedStats.staleFeeds > 0 && (
            <span className="text-slate-500">{feedStats.staleFeeds} stale</span>
          )}
        </div>
      )}

      {filteredFeeds.length === 0 ? (
        <EmptyState
          message="No feeds found"
          subMessage="Try adjusting your search, category, or priority filter."
          action={{
            label: "Clear Filters",
            onClick: () => {
              clearSearch();
              clearCategory();
              clearPriority();
            },
          }}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFeeds.map((feed) => (
            <div key={feed.id} className="card-hover p-4 text-left">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${statusDot(feed.status)}`}
                />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => navigate(`/feed/${feed.id}`)}
                    className="w-full text-left"
                    type="button"
                  >
                    <h3 className="text-sm font-semibold text-slate-800 truncate">
                      {feed.shortName}
                    </h3>
                    <p className="text-[0.6875rem] text-slate-500 mt-0.5">{feed.agency}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="badge bg-slate-100 text-slate-600">{feed.category}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 mt-3">
                    <Switch
                      checked={feed.enabled !== false}
                      onCheckedChange={() => toggleFeedEnabled(feed.id)}
                      aria-label={`${feed.shortName} enabled`}
                    />
                    {isUserFeed(feed) && (
                      <FeedFormDialog
                        mode="edit"
                        feed={feed}
                        onSave={(updates) => updateFeed(feed.id, updates)}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            data-testid="edit-feed"
                          >
                            <span className="sr-only">Edit</span>Edit
                          </Button>
                        }
                      />
                    )}
                    {isUserFeed(feed) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFeed(feed.id)}
                        data-testid="remove-feed"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {filteredFeeds.map((feed) => (
            <div
              key={feed.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <button
                onClick={() => navigate(`/feed/${feed.id}`)}
                className="min-w-0 flex flex-1 items-center gap-3 text-left"
                type="button"
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(feed.status)}`}
                  title={feed.status}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-slate-800 truncate">{feed.shortName}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[0.6875rem] text-slate-500">{feed.agency}</span>
                    <span className="badge bg-slate-100 text-slate-600">{feed.category}</span>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Switch
                  checked={feed.enabled !== false}
                  onCheckedChange={() => toggleFeedEnabled(feed.id)}
                  aria-label={`${feed.shortName} enabled`}
                />
                {feed.website && (
                  <a
                    href={feed.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    title="Visit website"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      aria-label={`${feed.shortName} actions`}
                    >
                      <MoreVertical size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isUserFeed(feed) && (
                      <DropdownMenuItem asChild>
                        <FeedFormDialog
                          mode="edit"
                          feed={feed}
                          onSave={(updates) => updateFeed(feed.id, updates)}
                          trigger={<span className="w-full cursor-pointer">Edit</span>}
                        />
                      </DropdownMenuItem>
                    )}
                    {isUserFeed(feed) && (
                      <DropdownMenuItem
                        onClick={() => removeFeed(feed.id)}
                        className="text-red-600"
                      >
                        Remove
                      </DropdownMenuItem>
                    )}
                    {!isUserFeed(feed) && (
                      <DropdownMenuItem disabled>Built-in feed</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
