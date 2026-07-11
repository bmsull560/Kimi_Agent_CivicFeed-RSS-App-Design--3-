import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { FeedFetchStatus } from "../types";
import { Button } from "@/components/ui/button";

interface FeedStatusPanelProps {
  status: FeedFetchStatus | null;
  loading?: boolean;
  onRefresh?: () => void;
}

function relativeTime(timestamp: number | null): string {
  if (!timestamp) return "Never";
  try {
    return `${formatDistanceToNow(timestamp, { addSuffix: true })}`;
  } catch {
    return "Unknown";
  }
}

export default function FeedStatusPanel({ status, loading, onRefresh }: FeedStatusPanelProps) {
  if (!status) {
    return (
      <div className="card p-4 text-sm text-slate-500">
        Fetch diagnostics are not available. Start the backend to see per-feed health and last refresh times.
      </div>
    );
  }

  const hasRecentError = status.lastErrorAt != null &&
    (status.lastSuccessAt == null || status.lastErrorAt > status.lastSuccessAt);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Fetch diagnostics</h2>
        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh diagnostics"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          {hasRecentError ? (
            <AlertCircle size={16} className="text-amber-600" aria-hidden="true" />
          ) : (
            <CheckCircle size={16} className="text-green-600" aria-hidden="true" />
          )}
          <span className="text-slate-700">
            {hasRecentError ? "Recent fetch failures" : "Feed is fetching successfully"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Clock size={16} aria-hidden="true" />
          <span>Last refreshed: {relativeTime(status.lastSuccessAt)}</span>
        </div>
        <div className="text-slate-600">
          Attempts: <span className="font-medium text-slate-800">{status.attemptCount}</span>
        </div>
        <div className="text-slate-600">
          Successes: <span className="font-medium text-green-700">{status.successCount}</span>
          {" / "}
          Failures: <span className="font-medium text-amber-700">{status.failureCount}</span>
        </div>
        {status.nextFetchAt != null && (
          <div className="text-slate-600 sm:col-span-2">
            Next scheduled refresh: {relativeTime(status.nextFetchAt)}
          </div>
        )}
      </div>

      {status.lastErrorMessage && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <p className="font-medium">Last error</p>
          <p className="mt-0.5">{status.lastErrorMessage}</p>
          {status.lastErrorAt && (
            <p className="mt-1 text-xs text-amber-700">{relativeTime(status.lastErrorAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}
