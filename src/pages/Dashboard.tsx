import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, ArrowRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserFeeds } from "../hooks/useUserFeeds";
import CategoryCard from "../components/CategoryCard";
import EntryCard from "../components/EntryCard";
import EmptyState from "../components/EmptyState";
import { thematicHubs } from "../lib/hubs";
import { getPreferences, updatePreferences } from "../lib/userData";
import type { RssEntry, SearchResultItem } from "../types";

function toRssEntry(r: SearchResultItem): RssEntry {
  return {
    id: r.entryId,
    title: r.title,
    link: r.link,
    description: r.description,
    pubDate: r.pubDate,
    author: r.author || undefined,
    feedId: r.feedId,
    feedName: r.feedName,
    fetchedAt: 0,
    aiSummary: r.aiSummary,
    aiTags: r.aiTags,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { allFeeds, enabledFeeds, catalogError, refresh } = useUserFeeds();
  const [recentEntries, setRecentEntries] = useState<RssEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setRecentLoading(true);
      try {
        const apiBase = import.meta.env?.VITE_API_URL || "";
        const candidates = new Set<string>([apiBase]);
        if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
          candidates.add("http://localhost:4000");
        }

        for (const base of candidates) {
          try {
            const res = await fetch(`${base}/api/articles/recent?limit=50`, {
              signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) continue;
            const data = (await res.json()) as { results?: SearchResultItem[] };
            setRecentEntries((data.results || []).map(toRssEntry));
            return;
          } catch {
            // try next candidate
          }
        }
      } finally {
        setRecentLoading(false);
      }
    };

    void load();
  }, []);

  const enabledIds = useMemo(() => new Set(enabledFeeds.map((f) => f.id)), [enabledFeeds]);
  const visibleRecent = recentEntries.filter((e) => enabledIds.has(e.feedId)).slice(0, 8);

  const preferences = useMemo(() => getPreferences(), []);
  const followedHubKeys = useMemo(() => preferences.followedHubs || [], [preferences.followedHubs]);
  const digestFrequency = preferences.digestFrequency;
  const personalized = followedHubKeys.length > 0;

  const sortedHubs = useMemo(() => {
    const followed = thematicHubs.filter((h) => followedHubKeys.includes(h.key));
    const rest = thematicHubs.filter((h) => !followedHubKeys.includes(h.key));
    return personalized ? [...followed, ...rest] : thematicHubs;
  }, [followedHubKeys, personalized]);

  const followedRecent = useMemo(() => {
    if (!personalized) return visibleRecent;
    const followedCategories = new Set(
      thematicHubs.filter((h) => followedHubKeys.includes(h.key)).flatMap((h) => h.categories)
    );
    return visibleRecent
      .filter((e) => {
        const feed = enabledFeeds.find((f) => f.id === e.feedId);
        return feed && followedCategories.has(feed.category);
      })
      .slice(0, 6);
  }, [visibleRecent, followedHubKeys, personalized, enabledFeeds]);

  const tierOneFeeds = enabledFeeds.filter((f) => f.priority === 1).slice(0, 6);

  const handleRefreshAll = () => {
    refresh();
    window.location.reload();
  };

  return (
    <div className="space-y-10">
      {/* Hero / Briefing header */}
      <section className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
          {personalized ? "Your Personalized Briefing" : "Your Daily Briefing"}
          {digestFrequency && (
            <span className="ml-2 text-slate-500 dark:text-slate-400 normal-case">
              •{" "}
              {digestFrequency === "realtime"
                ? "Real-time stream"
                : digestFrequency === "daily"
                  ? "Daily at 8:00 AM"
                  : "Weekly on Saturday"}
            </span>
          )}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
          U.S. Government RSS Feeds
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
          {personalized
            ? "Updates from the topics you follow, organized into clear hubs and summarized in plain language."
            : `Understand ${allFeeds.length} federal feeds without the noise—organized into five clear hubs and summarized in plain language.`}
          {enabledFeeds.length !== allFeeds.length && ` ${enabledFeeds.length} currently enabled.`}
        </p>
        {catalogError && <p className="text-sm text-amber-700 mt-3">{catalogError}</p>}
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <Button type="button" onClick={() => navigate("/feeds")}>
            Browse All Feeds <ArrowRight size={16} />
          </Button>
          <Button type="button" variant="outline" onClick={handleRefreshAll}>
            <RefreshCw size={16} /> Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              updatePreferences({ onboardingComplete: false });
              window.location.reload();
            }}
          >
            Personalize
          </Button>
        </div>
      </section>

      {/* Thematic Hubs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-slate-100">
            {personalized ? "Your Topics" : "Thematic Hubs"}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {sortedHubs.map((hub) => {
            const count = enabledFeeds.filter((f) => hub.categories.includes(f.category)).length;
            const isFollowed = followedHubKeys.includes(hub.key);
            return (
              <div key={hub.key} className="relative">
                {isFollowed && (
                  <span className="absolute -top-2 -right-2 z-10 inline-flex items-center justify-center size-5 rounded-full bg-blue-600 text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <CategoryCard
                  category={hub.label}
                  count={count}
                  icon={hub.icon}
                  onClick={() => navigate(`/feeds?hub=${encodeURIComponent(hub.key)}`)}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Critical Alerts — Tier 1 */}
      {tierOneFeeds.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} />
              Critical Alerts
            </h2>
            <Button type="button" variant="link" onClick={() => navigate("/feeds?priority=1")}>
              View all Tier 1 →
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tierOneFeeds.map((feed) => (
              <button
                key={feed.id}
                onClick={() => navigate(`/feed/${feed.id}`)}
                className="card-hover text-left"
                type="button"
              >
                <Card className="p-4 h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif font-semibold text-slate-900 dark:text-slate-100 text-sm">
                        {feed.shortName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {feed.agency}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 flex-shrink-0">
                      Tier 1
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">
                    {feed.description}
                  </p>
                </Card>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent Entries */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-slate-100">
            {personalized ? "For You" : "Recent Entries"}
          </h2>
          <Button type="button" variant="link" onClick={() => navigate("/reading")}>
            Reading stream →
          </Button>
        </div>
        {recentLoading ? (
          <p className="text-sm text-slate-500">Loading recent entries…</p>
        ) : (personalized ? followedRecent : visibleRecent).length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {(personalized ? followedRecent : visibleRecent).map((entry) => (
              <EntryCard key={entry.id} entry={entry} compact />
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <EmptyState
              message="No recent entries yet"
              subMessage="Visit a feed to load entries from the backend cache."
              action={{ label: "Browse Feeds", onClick: () => navigate("/feeds") }}
            />
          </Card>
        )}
      </section>
    </div>
  );
}
