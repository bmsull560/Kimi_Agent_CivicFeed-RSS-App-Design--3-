import { useNavigate, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { Rss, Calendar, Bookmark, Archive, Newspaper as News } from "lucide-react";
import { useUserFeeds } from "../hooks/useUserFeeds";
import { thematicHubs } from "../lib/hubs";

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}

function NavButton({ active, onClick, icon, label, count }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
      type="button"
    >
      <span className={active ? "text-primary-foreground" : "text-slate-500 dark:text-slate-400"}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {count != null && (
        <span
          className={`ml-auto text-[0.6875rem] flex-shrink-0 ${
            active ? "text-primary-foreground" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { enabledFeeds } = useUserFeeds();

  const searchParams = new URLSearchParams(location.search);
  const currentHub = searchParams.get("hub") || "";
  const currentCategory = searchParams.get("category") || "";
  const isAllFeeds = location.pathname === "/feeds" && !currentHub && !currentCategory;
  const isRecap = location.pathname === "/recap";
  const isReading = location.pathname === "/reading";
  const isBookmarks = location.pathname === "/bookmarks";
  const isArchive = location.pathname === "/archive";

  const handleHub = (hubKey: string) => {
    navigate(`/feeds?hub=${encodeURIComponent(hubKey)}`);
    onClose();
  };
  const handleAllFeeds = () => {
    navigate("/feeds");
    onClose();
  };
  const handleRecap = () => {
    navigate("/recap");
    onClose();
  };
  const handleReading = () => {
    navigate("/reading");
    onClose();
  };
  const handleBookmarks = () => {
    navigate("/bookmarks");
    onClose();
  };
  const handleArchive = () => {
    navigate("/archive");
    onClose();
  };

  const hubCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const hub of thematicHubs) {
      map[hub.key] = enabledFeeds.filter((f) => hub.categories.includes(f.category)).length;
    }
    return map;
  }, [enabledFeeds]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed lg:sticky top-14 left-0 z-40 w-64 h-[calc(100vh-3.5rem)] bg-card border-r border-border transform transition-transform lg:transform-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="navigation"
        aria-label="Feed categories"
      >
        <nav className="flex flex-col h-full" aria-label="Categories">
          <div className="px-3 py-3 space-y-0.5">
            <NavButton
              active={isReading}
              onClick={handleReading}
              icon={<News size={18} />}
              label="Reading Stream"
            />
            <NavButton
              active={isBookmarks}
              onClick={handleBookmarks}
              icon={<Bookmark size={18} />}
              label="Bookmarks"
            />
            <NavButton
              active={isArchive}
              onClick={handleArchive}
              icon={<Archive size={18} />}
              label="Archive"
            />
            <NavButton
              active={isAllFeeds}
              onClick={handleAllFeeds}
              icon={<Rss size={18} />}
              label="All Feeds"
              count={enabledFeeds.length}
            />
            <NavButton
              active={isRecap}
              onClick={handleRecap}
              icon={<Calendar size={18} />}
              label="Weekly Recap"
            />
          </div>

          <div className="px-4 pt-4 pb-1">
            <p className="text-[0.6875rem] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Thematic Hubs
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
            {thematicHubs.map((hub) => {
              const isActive = currentHub === hub.key;
              return (
                <button
                  key={hub.key}
                  onClick={() => handleHub(hub.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  type="button"
                >
                  <span
                    className={
                      isActive ? "text-primary-foreground" : "text-slate-500 dark:text-slate-400"
                    }
                  >
                    {hub.icon}
                  </span>
                  <span className="truncate">{hub.label}</span>
                  <span
                    className={`ml-auto text-[0.6875rem] flex-shrink-0 ${
                      isActive ? "text-primary-foreground" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {hubCounts[hub.key] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </aside>
    </>
  );
}
