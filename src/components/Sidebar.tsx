import { useNavigate, useLocation } from "react-router-dom";
import {
  Rss, TrendingUp, Globe, Shield, Heart, Leaf, Landmark, Scale, Briefcase, Store,
  Train, AlertTriangle, Palette, Eye, FileText, Star, Newspaper, BookOpen, Sprout,
  Cpu, Home, HeartPulse,
} from "lucide-react";
import { feedStats, categoryList, feeds } from "../data/feeds";

const categoryIcons: Record<string, React.ReactNode> = {
  "Finance & Economy": <TrendingUp size={18} />,
  "Diplomacy & Foreign Affairs": <Globe size={18} />,
  "Defense & Security": <Shield size={18} />,
  "Health & Science": <Heart size={18} />,
  "Environment & Energy": <Leaf size={18} />,
  "Congress & Legislation": <Landmark size={18} />,
  "Courts & Judiciary": <Scale size={18} />,
  "Labor & Employment": <Briefcase size={18} />,
  "Commerce & Trade": <Store size={18} />,
  "Transportation": <Train size={18} />,
  "Safety & Consumer Protection": <AlertTriangle size={18} />,
  "Grants & Arts": <Palette size={18} />,
  "Oversight & Audits": <Eye size={18} />,
  "Rulemaking & Regulations": <FileText size={18} />,
  "Executive & Press": <Star size={18} />,
  "General": <Newspaper size={18} />,
  "Development & Education": <BookOpen size={18} />,
  "Agriculture & Food": <Sprout size={18} />,
  "Technology, Cybersecurity, & Space": <Cpu size={18} />,
  "Housing, Urban Development, & Infrastructure": <Home size={18} />,
  "Veterans Affairs, Healthcare, & Benefits": <HeartPulse size={18} />,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const byCategory = feedStats.byCategory as Record<string, number>;

interface SidebarProps { isOpen: boolean; onClose: () => void; }

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentCategory = new URLSearchParams(location.search).get("category") || "";
  const isAllFeeds = location.pathname === "/feeds" && !currentCategory;

  const handleCategory = (cat: string) => { navigate(`/feeds?category=${encodeURIComponent(cat)}`); onClose(); };
  const handleAllFeeds = () => { navigate("/feeds"); onClose(); };
  const currentPriority = new URLSearchParams(location.search).get("priority") || "";
  const handlePriority = (tier: number) => { navigate(`/feeds?priority=${tier}`); onClose(); };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside className={`fixed lg:sticky top-0 lg:top-[97px] left-0 z-40 w-64 h-[calc(100vh-97px)] bg-white border-r border-slate-200 transform transition-transform lg:transform-none ${isOpen ? "translate-x-0" : "-translate-x-full"}`} role="navigation" aria-label="Feed categories">
        <nav className="flex flex-col h-full" aria-label="Categories">
          <div className="px-3 py-2">
            <button onClick={handleAllFeeds} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isAllFeeds ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`} type="button">
              <Rss size={18} /> All Feeds
              <span className={`ml-auto text-[0.6875rem] ${isAllFeeds ? "text-white/70" : "text-slate-400"}`}>{feedStats.total}</span>
            </button>
          </div>
          <div className="px-4 pt-2 pb-1">
            <p className="text-[0.6875rem] font-semibold text-slate-400 uppercase tracking-wider">Categories</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
            {categoryList.map(cat => {
              const count = byCategory[cat] || 0;
              const isActive = currentCategory === cat;
              return (
                <button key={cat} onClick={() => handleCategory(cat)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-blue-600 text-white font-medium" : "text-slate-700 hover:bg-slate-100"}`} type="button">
                  <span className={isActive ? "text-white" : "text-slate-500"}>{categoryIcons[cat] || <Newspaper size={18} />}</span>
                  <span className="truncate">{cat}</span>
                  <span className={`ml-auto text-[0.6875rem] flex-shrink-0 ${isActive ? "text-white/70" : "text-slate-400"}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="px-4 pt-4 pb-1">
            <p className="text-[0.6875rem] font-semibold text-slate-400 uppercase tracking-wider">Priority</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
            {[
              { tier: 1, label: "Tier 1 — Safety & Emergency", icon: <AlertTriangle size={18} /> },
              { tier: 2, label: "Tier 2 — Financial", icon: <TrendingUp size={18} /> },
              { tier: 3, label: "Tier 3 — Transportation", icon: <Train size={18} /> },
              { tier: 4, label: "Tier 4 — Environment & Energy", icon: <Leaf size={18} /> },
              { tier: 5, label: "Tier 5 — Security", icon: <Shield size={18} /> },
              { tier: 6, label: "Tier 6 — Oversight", icon: <Eye size={18} /> },
            ].map(({ tier, label, icon }) => {
              const isActive = currentPriority === String(tier);
              const count = feeds.filter(f => f.priority === tier).length;
              return (
                <button key={tier} onClick={() => handlePriority(tier)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-blue-600 text-white font-medium" : "text-slate-700 hover:bg-slate-100"}`} type="button">
                  <span className={isActive ? "text-white" : "text-slate-500"}>{icon}</span>
                  <span className="truncate">{label}</span>
                  <span className={`ml-auto text-[0.6875rem] flex-shrink-0 ${isActive ? "text-white/70" : "text-slate-400"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </aside>
    </>
  );
}
