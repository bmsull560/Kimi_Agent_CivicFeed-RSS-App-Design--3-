import { useFeedStatus } from "../hooks/useFeedStatus";
import FeedStatusPanel from "./FeedStatusPanel";

interface FeedStatusSectionProps {
  feedId: string;
}

export default function FeedStatusSection({ feedId }: FeedStatusSectionProps) {
  const { status, health, loading, refresh } = useFeedStatus(feedId);
  return <FeedStatusPanel status={status} health={health} loading={loading} onRefresh={refresh} />;
}
