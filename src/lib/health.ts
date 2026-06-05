import type { FeedHealth } from "../types";

let healthCache: FeedHealth[] | null = null;

export async function loadFeedHealth(): Promise<FeedHealth[]> {
  if (healthCache) return healthCache;
  try {
    const response = await fetch("/feed-health.json");
    if (!response.ok) return [];
    healthCache = (await response.json()) as FeedHealth[];
    return healthCache;
  } catch {
    return [];
  }
}

export function getFeedHealth(healthData: FeedHealth[], feedId: string): FeedHealth | undefined {
  return healthData.find((h) => h.feedId === feedId);
}

export function getHealthCounts(healthData: FeedHealth[]) {
  return {
    ok: healthData.filter((h) => h.status === "ok").length,
    warn: healthData.filter((h) => h.status === "warn").length,
    fail: healthData.filter((h) => h.status === "fail").length,
    total: healthData.length,
  };
}

export function healthStatusColor(status: FeedHealth["status"]): string {
  switch (status) {
    case "ok":
      return "bg-green-500";
    case "warn":
      return "bg-amber-500";
    case "fail":
      return "bg-red-500";
    default:
      return "bg-slate-300";
  }
}

export function healthStatusLabel(status: FeedHealth["status"]): string {
  switch (status) {
    case "ok":
      return "Healthy";
    case "warn":
      return "Warning";
    case "fail":
      return "Failed";
    default:
      return "Unknown";
  }
}
