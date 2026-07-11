import { useFeedStatus } from "../hooks/useFeedStatus";
import FeedStatusPanel from "./FeedStatusPanel";

interface FeedStatusSectionProps {
  feedId: string;
}

export default function FeedStatusSection({ feedId }: FeedStatusSectionProps) {
  const { status, loading, refresh } = useFeedStatus(feedId);
  return <FeedStatusPanel status={status} loading={loading} onRefresh={refresh} />;
}
