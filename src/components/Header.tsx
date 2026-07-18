import { useState, useRef, useEffect, useMemo } from "react";
import { Shield, Search, Menu, X, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useUserFeeds } from "../hooks/useUserFeeds";
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
  const { theme, setTheme } = useTheme();
  const { allFeeds } = useUserFeeds();

  const results = useMemo<Feed[]>(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return allFeeds
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.agency.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q) ||
          f.tags.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, allFeeds]);

  const isDropdownVisible = showDropdown && query.length >= 2;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      )
        setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
      if (e.key === "Escape") {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleSelect = (feed: Feed) => {
    setQuery("");
    setShowDropdown(false);
    navigate(`/feed/${feed.id}`);
  };

  const handleSearchSubmit = () => {
    if (query.trim()) {
      setShowDropdown(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 focus-ring"
              type="button"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <a
              href="#/"
              className="flex items-center gap-2 text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Shield size={22} className="text-blue-600" />
              <span className="text-xl font-bold tracking-tight font-serif">CivicFeed</span>
            </a>
          </div>

          <div className="hidden md:block flex-1 max-w-lg" ref={dropdownRef}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-muted-foreground" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuery(value);
                  setShowDropdown(value.length >= 2);
                }}
                onFocus={() => query.length >= 2 && setShowDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit();
                }}
                placeholder="Search democratic updates… (press / to focus)"
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Search feeds"
                role="combobox"
                aria-expanded={isDropdownVisible}
                aria-autocomplete="list"
              />
              {isDropdownVisible && results.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
                  role="listbox"
                >
                  {results.map((feed) => (
                    <button
                      key={feed.id}
                      onClick={() => handleSelect(feed)}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent flex items-center gap-3 transition-colors"
                      role="option"
                      type="button"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {feed.shortName}
                        </p>
                        <p className="text-[0.6875rem] text-muted-foreground">{feed.category}</p>
                      </div>
                    </button>
                  ))}
                  {query.length >= 2 && (
                    <button
                      onClick={handleSearchSubmit}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent flex items-center gap-3 transition-colors border-t border-border bg-muted/50"
                      type="button"
                    >
                      <Search size={14} className="text-primary" />
                      <span className="text-sm font-medium text-primary">
                        Search articles for &ldquo;{query}&rdquo;…
                      </span>
                    </button>
                  )}
                </div>
              )}
              {isDropdownVisible && results.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 px-4 py-3 text-sm text-muted-foreground">
                  No feeds found for &ldquo;{query}&rdquo;
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg hover:bg-muted text-foreground focus-ring"
            type="button"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
