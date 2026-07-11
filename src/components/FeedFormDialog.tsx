import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryList } from "@/data/feeds";
import type { DiscoveredFeed, Feed, UserFeed } from "@/types";
import { discoverFeeds, fetchFeed } from "@/lib/rss";

export interface FeedFormDialogProps {
  mode: "add" | "edit";
  feed?: UserFeed;
  onSave: (feed: Omit<Feed, "id" | "status" | "userAdded" | "enabled" | "addedAt">) => boolean | Promise<boolean>;
  trigger?: React.ReactNode;
}

const DEFAULT_CATEGORY = "General";

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function FeedFormDialog({ mode, feed, onSave, trigger }: FeedFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(feed?.name ?? "");
  const [rssUrl, setRssUrl] = useState(feed?.rssUrl ?? "");
  const [website, setWebsite] = useState(feed?.website ?? "");
  const [category, setCategory] = useState(feed?.category ?? DEFAULT_CATEGORY);
  const [priority, setPriority] = useState<string>(feed?.priority ? String(feed.priority) : "");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
  const [discovering, setDiscovering] = useState(false);

  const resetForm = () => {
    setName(feed?.name ?? "");
    setRssUrl(feed?.rssUrl ?? "");
    setWebsite(feed?.website ?? "");
    setCategory(feed?.category ?? DEFAULT_CATEGORY);
    setPriority(feed?.priority ? String(feed.priority) : "");
    setError(null);
    setValidating(false);
    setDiscoveredFeeds([]);
    setDiscovering(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) resetForm();
  };

  const validate = async (): Promise<boolean> => {
    setError(null);
    if (!name.trim()) {
      setError("Feed name is required.");
      return false;
    }
    if (!isValidHttpUrl(rssUrl)) {
      setError("A valid HTTP/HTTPS RSS URL is required.");
      return false;
    }
    if (website && !isValidHttpUrl(website)) {
      setError("Website must be a valid HTTP/HTTPS URL.");
      return false;
    }

    setValidating(true);
    try {
      const result = await fetchFeed(rssUrl, "preview", name);
      if (result.error || result.entries.length === 0) {
        setError(`Could not fetch a valid feed from this URL. ${result.error || ""}`.trim());
        return false;
      }
      return true;
    } catch (e) {
      setError(`Feed preview failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    const ok = await validate();
    if (!ok) return;

    const saved = await Promise.resolve(
      onSave({
        name: name.trim(),
        shortName: name.trim(),
        agency: "",
        description: "",
        rssUrl: rssUrl.trim(),
        website: website.trim(),
        department: "",
        category,
        subCategory: category,
        contentType: "",
        updateFrequency: "",
        tags: [],
        priority: priority ? (parseInt(priority, 10) as 1 | 2 | 3 | 4 | 5 | 6) : undefined,
      })
    );
    if (saved) {
      setOpen(false);
    }
  };

  const handleDiscover = async () => {
    if (!isValidHttpUrl(rssUrl)) {
      setError("Enter a valid URL to discover feeds.");
      return;
    }
    setDiscovering(true);
    setError(null);
    setDiscoveredFeeds([]);
    try {
      const feeds = await discoverFeeds(rssUrl);
      if (feeds.length === 0) {
        setError("No RSS or Atom feeds found at that URL.");
      } else {
        setDiscoveredFeeds(feeds);
      }
    } catch (err) {
      setError(`Discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDiscovering(false);
    }
  };

  const selectDiscoveredFeed = (feed: DiscoveredFeed) => {
    setRssUrl(feed.href);
    if (!name.trim()) {
      setName(feed.title);
    }
    setDiscoveredFeeds([]);
  };

  const title = mode === "add" ? "Add Feed" : "Edit Feed";
  const description = mode === "add"
    ? "Subscribe to a new RSS or Atom feed."
    : "Update this feed's details.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="sm">
            {mode === "add" ? <Plus size={16} /> : <Pencil size={16} />}
            {mode === "add" ? "Add Feed" : "Edit"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="feed-name">Name</Label>
            <Input id="feed-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. EPA News" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feed-url">RSS / Atom URL</Label>
            <div className="flex gap-2">
              <Input
                id="feed-url"
                value={rssUrl}
                onChange={e => { setRssUrl(e.target.value); setDiscoveredFeeds([]); }}
                placeholder="https://example.com/feed.xml or https://example.com"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscover}
                disabled={discovering || !isValidHttpUrl(rssUrl)}
                aria-label="Discover feeds from this URL"
              >
                {discovering ? "Discovering..." : "Discover"}
              </Button>
            </div>
            {discoveredFeeds.length > 0 && (
              <div className="border border-slate-200 rounded-md p-2 space-y-1">
                <p className="text-xs text-slate-600 font-medium">Discovered feeds:</p>
                {discoveredFeeds.map((f, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectDiscoveredFeed(f)}
                    className="w-full text-left text-sm px-2 py-1.5 hover:bg-slate-50 rounded"
                    aria-label={`Select feed ${f.title}`}
                  >
                    <span className="font-medium text-slate-800">{f.title}</span>
                    <span className="text-xs text-slate-500 block truncate">{f.href}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feed-website">Website (optional)</Label>
            <Input id="feed-website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feed-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="feed-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryList.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feed-priority">Priority tier (optional)</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="feed-priority">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(t => (
                  <SelectItem key={t} value={String(t)}>Tier {t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={validating || discovering}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={validating || discovering}>
            {validating ? "Validating..." : mode === "add" ? "Add Feed" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
