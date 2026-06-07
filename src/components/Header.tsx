import { useState, useRef, useEffect, useMemo } from "react";
import { Shield, Search, Rss, Menu, X } from "lucide-react";
import { feedStats, searchFeeds } from "../data/feeds";
import type { Feed } from "../types";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  onMenuToggle?: () => void;
  sidebarOpen?: boolean;
}

export default function Header({ onMenuToggle, sidebarOpen }: HeaderProps) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => query.length >= 2 ? searchFeeds(query).slice(0, 8) : [], [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node))
        setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); inputRef.current?.focus(); }
      }
      if (e.key === "Escape") { setShowDropdown(false); inputRef.current?.blur(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleSelect = (feed: Feed) => { setQuery(""); setShowDropdown(false); navigate(`/feed/${feed.id}`); };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="flex items-center justify-between px-4 lg:px-6 h-14">
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600" type="button" aria-label="Toggle menu">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <a href="#/" className="flex items-center gap-2 text-slate-900 hover:text-blue-600 transition-colors">
            <Shield size={22} className="text-blue-600" />
            <span className="text-lg font-bold tracking-tight">CivicFeed</span>
            <Rss size={14} className="text-slate-400 -ml-0.5" />
          </a>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[0.6875rem] text-slate-500">
          <span className="badge bg-slate-100 text-slate-600">{feedStats.total} Feeds</span>
          <span className="badge bg-blue-50 text-blue-600">{Object.keys(feedStats.byCategory).length} Categories</span>
        </div>
      </div>
      <div className="px-4 lg:px-6 pb-3">
        <div className="relative max-w-xl" ref={dropdownRef}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-slate-400" /></div>
          <input ref={inputRef} type="text" value={query} onChange={e => { const value = e.target.value; setQuery(value); setShowDropdown(value.length >= 2); }} onFocus={() => query.length >= 2 && setShowDropdown(true)}
            placeholder="Search feeds... (press / to focus)" className="input w-full pl-9 pr-4 py-2 text-sm"
            aria-label="Search feeds" role="combobox" aria-expanded={showDropdown} aria-autocomplete="list" />
          {showDropdown && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden" role="listbox">
              {results.map(feed => (
                <button key={feed.id} onClick={() => handleSelect(feed)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors" role="option" type="button">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{feed.shortName}</p>
                    <p className="text-[0.6875rem] text-slate-500">{feed.category}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && query.length >= 2 && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 px-4 py-3 text-sm text-slate-500">No feeds found for &ldquo;{query}&rdquo;</div>
          )}
        </div>
      </div>
    </header>
  );
}
