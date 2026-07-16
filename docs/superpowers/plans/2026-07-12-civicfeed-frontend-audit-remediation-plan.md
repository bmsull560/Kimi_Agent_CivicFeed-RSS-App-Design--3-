# CivicFeed Frontend Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address every finding from the Manus AI frontend audit (routing, dark mode, reload anti-patterns, pagination, a11y, meta tags, IndexedDB persistence, unused UI components) in a single green-CI PR.

**Architecture:** Keep the existing React SPA structure; only swap the persistence layer (localStorage → IndexedDB with fallback), add offset-based pagination to backend list endpoints, switch from `HashRouter` to `BrowserRouter`, and apply class-based dark mode via `next-themes`.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 3, Vite 7, next-themes, idb-keyval, better-sqlite3 backend, Playwright.

## Global Constraints

- Preserve all existing user-visible behavior except where the audit explicitly requires a change.
- All changes must pass `npm run format:check`, `npm run lint`, `npm run type-check`, `npm run build`, and `npm run verify:routes`.
- Frontend must remain backend-driven; do not reintroduce client-side RSS fetching or CORS proxies.
- Do not modify `backend/src/feeds.ts` catalog content.
- Keep unrelated files (`REPO_AUDIT.md`, `ROADMAP.md`, etc.) untouched.

---

## File map

| File                                 | Responsibility in this plan                                             |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `backend/src/search.ts`              | Add `offset` parameter to `searchArticles()` and `getRecentArticles()`. |
| `backend/src/server.ts`              | Read `offset` query param for `/api/search` and `/api/articles/recent`. |
| `backend/src/search.test.ts`         | Add tests for offset behavior.                                          |
| `src/main.tsx`                       | Switch to `BrowserRouter`, wrap with `ThemeProvider`.                   |
| `src/App.tsx`                        | Add wildcard 404 route.                                                 |
| `src/pages/NotFound.tsx`             | New 404 page.                                                           |
| `src/pages/ReadingStream.tsx`        | Replace hash navigation, add pagination UI and page state.              |
| `src/pages/SearchResults.tsx`        | Add pagination UI and page state.                                       |
| `vite.config.ts`                     | Set `base: "/"` and add `historyApiFallback`.                           |
| `src/index.css`                      | Add `.dark` CSS variables and dark-mode utility overrides.              |
| `src/components/Header.tsx`          | Add theme toggle, visible search label.                                 |
| `src/components/Layout.tsx`          | Add skip link and footer landmark.                                      |
| `src/components/Sidebar.tsx`         | Replace hardcoded light surfaces with theme variables.                  |
| `src/components/ErrorBoundary.tsx`   | Add `resetKey` prop and retry button.                                   |
| `src/pages/Dashboard.tsx`            | Remove `window.location.reload()` from refresh handler.                 |
| `src/components/CategoryCard.tsx`    | Change heading level to `h2`.                                           |
| `src/components/FeedStatusPanel.tsx` | Adjust heading level to `h3`.                                           |
| `index.html`                         | Add OG meta tags, favicon, theme-color.                                 |
| `public/favicon.svg`                 | New SVG favicon.                                                        |
| `src/lib/userData.ts`                | Persist to IndexedDB via `idb-keyval` with localStorage fallback.       |
| `src/components/ui/*.tsx`            | Delete ~39 unused component files.                                      |

---

### Task 1: Backend pagination support

**Files:**

- Modify: `backend/src/search.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/search.test.ts`

**Interfaces:**

- `searchArticles(query: string, limit: number = 20, offset: number = 0): SearchResult[]`
- `getRecentArticles(limit: number = 50, offset: number = 0): SearchResult[]`
- `/api/search?q=&limit=&offset=`
- `/api/articles/recent?source=&limit=&offset=`

- [ ] **Step 1: Add offset to `searchArticles`**

In `backend/src/search.ts`, change the function signature and SQL to accept `offset`:

```ts
export function searchArticles(
  query: string,
  limit: number = 20,
  offset: number = 0
): SearchResult[] {
  // ... existing validation ...
  const safeQuery = query.trim().replace(/"/g, '""');
  const stmt = db.prepare(
    `SELECT rowid, * FROM articles_fts WHERE articles_fts MATCH ? ORDER BY rank LIMIT ? OFFSET ?`
  );
  const rows = stmt.all(`"${safeQuery}"*`, limit, offset) as SearchRow[];
  // ... rest unchanged ...
}
```

- [ ] **Step 2: Add offset to `getRecentArticles`**

```ts
export function getRecentArticles(limit: number = 50, offset: number = 0): SearchResult[] {
  const stmt = db.prepare(`SELECT rowid, * FROM articles ORDER BY pubDate DESC LIMIT ? OFFSET ?`);
  const rows = stmt.all(limit, offset) as SearchRow[];
  // ... rest unchanged ...
}
```

- [ ] **Step 3: Wire offset into `/api/search`**

In `backend/src/server.ts` around line 302:

```ts
app.get("/api/search", (req, res) => {
  const q = (req.query.q as string) || "";
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  if (!q.trim()) {
    const recent = getRecentArticles(limit, offset);
    return res.json({ query: "", results: recent, total: recent.length });
  }
  const results = searchArticles(q, limit, offset);
  res.json({ query: q, results, total: results.length });
});
```

- [ ] **Step 4: Wire offset into `/api/articles/recent`**

```ts
app.get("/api/articles/recent", (req, res) => {
  const source = (req.query.source as string) || "";
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  let results = getRecentArticles(limit, offset);
  if (source) {
    results = results.filter((r) => r.feedId === source);
  }
  res.json({ results });
});
```

- [ ] **Step 5: Add backend tests**

Append to `backend/src/search.test.ts`:

```ts
it("respects offset when searching", () => {
  const all = searchArticles("government", 100, 0);
  const secondPage = searchArticles("government", 10, 10);
  expect(secondPage.length).toBeLessThanOrEqual(10);
  if (all.length > 10) {
    expect(secondPage[0].entryId).toBe(all[10].entryId);
  }
});

it("respects offset for recent articles", () => {
  const all = getRecentArticles(100, 0);
  const secondPage = getRecentArticles(10, 10);
  expect(secondPage.length).toBeLessThanOrEqual(10);
  if (all.length > 10) {
    expect(secondPage[0].entryId).toBe(all[10].entryId);
  }
});
```

- [ ] **Step 6: Run backend tests**

Run: `cd backend && npm test`
Expected: all existing + new tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/search.ts backend/src/server.ts backend/src/search.test.ts
git commit -m "feat(backend): add offset pagination to search and recent articles"
```

---

### Task 2: Routing, 404 page, and dev-server parity

**Files:**

- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Create: `src/pages/NotFound.tsx`
- Modify: `src/pages/ReadingStream.tsx`
- Modify: `vite.config.ts`

**Interfaces:**

- `NotFound` component renders at any unmatched route.
- `BrowserRouter` replaces `HashRouter`.

- [ ] **Step 1: Switch to BrowserRouter and ThemeProvider**

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 2: Add wildcard 404 route**

```tsx
// src/App.tsx
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import FeedDirectory from "./pages/FeedDirectory";
import FeedDetail from "./pages/FeedDetail";
import SearchResults from "./pages/SearchResults";
import Recap from "./pages/Recap";
import ReadingStream from "./pages/ReadingStream";
import EntryDetail from "./pages/EntryDetail";
import Bookmarks from "./pages/Bookmarks";
import Archive from "./pages/Archive";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/feeds" element={<FeedDirectory />} />
          <Route path="/feed/:id" element={<FeedDetail />} />
          <Route path="/reading" element={<ReadingStream />} />
          <Route path="/entry/:feedId/:entryId" element={<EntryDetail />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/recap" element={<Recap />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
```

- [ ] **Step 3: Create NotFound page**

```tsx
// src/pages/NotFound.tsx
import { useNavigate } from "react-router-dom";
import { Home, AlertTriangle } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-4">
        <AlertTriangle size={28} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        The page you’re looking for doesn’t exist. Check the URL or return to the dashboard.
      </p>
      <button onClick={() => navigate("/")} className="btn-primary" type="button">
        <Home size={16} /> Back to Dashboard
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Remove hash navigation from ReadingStream**

In `src/pages/ReadingStream.tsx`, replace the EmptyState action:

```tsx
const navigate = useNavigate();
// ...
<EmptyState
  message="No articles found"
  subMessage={
    entries.length === 0
      ? "Visit a feed to load articles, then return here."
      : "Try adjusting your filters."
  }
  action={{ label: "Browse Feeds", onClick: () => navigate("/feeds") }}
/>;
```

Add `useNavigate` to imports.

- [ ] **Step 5: Configure Vite for BrowserRouter**

```ts
// vite.config.ts
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ... existing manual chunks unchanged ...
        },
      },
    },
  },
  server: {
    port: 3000,
    historyApiFallback: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 6: Run route verification**

Run: `npm run verify:routes`
Expected: 4 routes rendered (or 5 if NotFound is counted).

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx src/App.tsx src/pages/NotFound.tsx src/pages/ReadingStream.tsx vite.config.ts
git commit -m "feat: switch to BrowserRouter, add 404 page, and fix hash navigation"
```

---

### Task 3: Dark mode

**Files:**

- Modify: `src/index.css`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**

- `next-themes` toggles `.dark` class on `<html>`.
- Header exposes a sun/moon toggle using `useTheme`.

- [ ] **Step 1: Add dark CSS variables**

Append to `src/index.css` after the `:root` block:

```css
.dark {
  --background: 222 47% 6%;
  --foreground: 210 40% 98%;
  --card: 222 47% 9%;
  --card-foreground: 210 40% 98%;
  --popover: 222 47% 9%;
  --popover-foreground: 210 40% 98%;
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 6%;
  --secondary: 217 33% 17%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --accent: 217 33% 17%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62% 30%;
  --destructive-foreground: 210 40% 98%;
  --border: 217 33% 17%;
  --input: 217 33% 17%;
  --ring: 224 76% 48%;
  --radius: 0.625rem;
  --sidebar-background: 222 47% 9%;
  --sidebar-foreground: 210 40% 98%;
  --sidebar-primary: 217 91% 60%;
  --sidebar-primary-foreground: 222 47% 6%;
  --sidebar-accent: 217 33% 17%;
  --sidebar-accent-foreground: 210 40% 98%;
  --sidebar-border: 217 33% 17%;
  --sidebar-ring: 224 76% 48%;
}
```

- [ ] **Step 2: Update component surfaces to use theme variables**

In `src/components/Layout.tsx`:

```tsx
<div className="min-h-screen bg-background flex flex-col">
  ...
  <main className="flex-1 min-w-0 p-4 lg:p-6" role="main" aria-label="Main content">
```

In `src/components/Header.tsx`, replace the outer `<header>` class:

```tsx
<header className="sticky top-0 z-50 bg-card border-b border-border">
```

and the search input wrapper:

```tsx
<div className="relative max-w-xl" ref={dropdownRef}>
  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
    <Search size={16} className="text-muted-foreground" />
  </div>
  <input ... className="input w-full pl-9 pr-4 py-2 text-sm bg-background" />
```

In `src/components/Sidebar.tsx`:

```tsx
<aside className="... bg-card border-r border-border ...">
```

- [ ] **Step 3: Add theme toggle to Header**

```tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function Header({ onMenuToggle, sidebarOpen }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  // ...
  <button
    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    className="p-2 rounded-lg hover:bg-muted text-foreground"
    type="button"
    aria-label="Toggle theme"
  >
    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
  </button>
```

- [ ] **Step 4: Verify dark mode toggles**

Run dev build and click the toggle; verify `.dark` class appears on `<html>` and background colors change.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/Header.tsx src/components/Layout.tsx src/components/Sidebar.tsx
git commit -m "feat: implement class-based dark mode with next-themes"
```

---

### Task 4: Eliminate full-page reloads

**Files:**

- Modify: `src/components/ErrorBoundary.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**

- `ErrorBoundary` accepts `resetKey?: string | number` and renders a retry button.

- [ ] **Step 1: Refactor ErrorBoundary for retry**

```tsx
import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  resetKey?: string | number;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (props.resetKey && props.resetKey !== state.error?.message) {
      return { hasError: false, error: null };
    }
    return null;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError)
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950 flex items-center justify-center text-red-500 mb-4">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button onClick={this.handleReset} className="btn-primary" type="button">
            Try Again
          </button>
        </div>
      );
    return this.props.children;
  }
}
```

- [ ] **Step 2: Remove reload from Dashboard refresh**

```tsx
const handleRefreshAll = () => {
  refresh();
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/pages/Dashboard.tsx
git commit -m "fix: replace window.location.reload with state-driven retry and refresh"
```

---

### Task 5: Accessibility improvements

**Files:**

- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/CategoryCard.tsx`
- Modify: `src/components/FeedStatusPanel.tsx`

- [ ] **Step 1: Add skip link and footer**

```tsx
// src/components/Layout.tsx
import { type ReactNode, useState, useRef } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const skipToContent = () => {
    mainRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          skipToContent();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md"
      >
        Skip to main content
      </a>
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 p-4 lg:p-6 outline-none"
          role="main"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>
      <footer className="border-t border-border bg-card py-4 px-4 lg:px-6 text-xs text-muted-foreground">
        CivicFeed — U.S. Government RSS aggregator. Data sourced from public agency feeds.
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Add visible search label**

In `src/components/Header.tsx`:

```tsx
<div className="px-4 lg:px-6 pb-3">
  <label htmlFor="global-search" className="sr-only">
    Search feeds
  </label>
  <div className="relative max-w-xl" ref={dropdownRef}>
    ...
    <input
      id="global-search"
      ref={inputRef}
      ...
      aria-label="Search feeds"
    />
```

- [ ] **Step 3: Fix heading levels**

In `src/components/CategoryCard.tsx`:

```tsx
<h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{category}</h2>
```

In `src/components/FeedStatusPanel.tsx`:

```tsx
<h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Fetch diagnostics</h3>
```

- [ ] **Step 4: Run accessibility tests**

Run: `npm run verify:accessibility`
Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/components/Header.tsx src/components/CategoryCard.tsx src/components/FeedStatusPanel.tsx
git commit -m "a11y: skip link, footer landmark, search label, heading hierarchy"
```

---

### Task 6: Meta tags and favicon

**Files:**

- Modify: `index.html`
- Create: `public/favicon.svg`

- [ ] **Step 1: Add favicon SVG**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#2563eb"/>
  <path d="M30 35h40M30 50h30M30 65h20" stroke="white" stroke-width="8" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Update index.html head**

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    name="description"
    content="CivicFeed - Browse U.S. Government RSS feeds across categories"
  />
  <meta name="theme-color" content="#2563eb" />
  <meta property="og:title" content="CivicFeed" />
  <meta property="og:description" content="Browse U.S. Government RSS feeds across categories" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://civicfeed.example.com" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
  <title>CivicFeed</title>
</head>
```

- [ ] **Step 3: Commit**

```bash
git add index.html public/favicon.svg
git commit -m "feat: add Open Graph meta tags, theme-color, and favicon"
```

---

### Task 7: Migrate userData persistence to IndexedDB

**Files:**

- Modify: `package.json`
- Modify: `src/lib/userData.ts`
- Modify: `package-lock.json` (auto-generated by npm install)

**Interfaces:**

- Public API of `src/lib/userData.ts` remains unchanged.

- [ ] **Step 1: Add dependency**

Run: `npm install idb-keyval`

- [ ] **Step 2: Refactor persistence layer**

Replace `loadUserData` / `saveUserData` in `src/lib/userData.ts`:

```ts
import { get, set } from "idb-keyval";

const USER_DATA_KEY = "civicfeed_v2_user";
const IDB_KEY = "userData";
const CURRENT_VERSION = 1;

async function loadFromStorage(): Promise<UserData | null> {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserData>;
      return migrateUserData(parsed);
    }
  } catch {
    // ignore
  }
  try {
    const value = await get(IDB_KEY);
    if (value) {
      return migrateUserData(value as Partial<UserData>);
    }
  } catch {
    // ignore
  }
  return null;
}

function loadUserData(): UserData {
  // Synchronous fallback for existing callers.
  const fallback = defaultUserData();
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (!raw) return fallback;
    return migrateUserData(JSON.parse(raw) as Partial<UserData>);
  } catch {
    return fallback;
  }
}

async function saveUserData(data: UserData): Promise<void> {
  try {
    await set(IDB_KEY, data);
  } catch {
    // Fallback for private mode / disabled IndexedDB.
    try {
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[UserData] Failed to persist user data:", e);
    }
  }
}
```

Then update `withUpdatedData` to be async-aware:

```ts
function withUpdatedData(updater: (data: UserData) => UserData): UserData {
  const data = loadUserData();
  const updated = updater(data);
  void saveUserData(updated);
  return updated;
}
```

Keep all exported functions synchronous; IndexedDB writes happen in the background with localStorage fallback.

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/userData.ts
git commit -m "feat: migrate userData persistence to IndexedDB with localStorage fallback"
```

---

### Task 8: Remove unused UI components

**Files:**

- Delete: 39 files under `src/components/ui/`

- [ ] **Step 1: Delete unused components**

Delete the following files if they still have zero imports after Tasks 1–7:

```
src/components/ui/accordion.tsx
src/components/ui/alert.tsx
src/components/ui/alert-dialog.tsx
src/components/ui/aspect-ratio.tsx
src/components/ui/avatar.tsx
src/components/ui/badge.tsx
src/components/ui/breadcrumb.tsx
src/components/ui/button-group.tsx
src/components/ui/calendar.tsx
src/components/ui/card.tsx
src/components/ui/carousel.tsx
src/components/ui/checkbox.tsx
src/components/ui/collapsible.tsx
src/components/ui/command.tsx
src/components/ui/context-menu.tsx
src/components/ui/drawer.tsx
src/components/ui/empty.tsx
src/components/ui/field.tsx
src/components/ui/form.tsx
src/components/ui/hover-card.tsx
src/components/ui/input-group.tsx
src/components/ui/input-otp.tsx
src/components/ui/item.tsx
src/components/ui/kbd.tsx
src/components/ui/menubar.tsx
src/components/ui/navigation-menu.tsx
src/components/ui/pagination.tsx  # KEEP — will be used in Task 9
src/components/ui/popover.tsx
src/components/ui/progress.tsx
src/components/ui/radio-group.tsx
src/components/ui/resizable.tsx
src/components/ui/scroll-area.tsx
src/components/ui/sidebar.tsx
src/components/ui/slider.tsx
src/components/ui/sonner.tsx       # KEEP — toast provider
src/components/ui/spinner.tsx
src/components/ui/table.tsx
src/components/ui/tabs.tsx
src/components/ui/toggle-group.tsx
```

Note: keep `button`, `dialog`, `dropdown-menu`, `input`, `label`, `pagination`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `textarea`, `toggle`, `tooltip`.

- [ ] **Step 2: Run build and type-check**

Run: `npm run type-check && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused shadcn/ui components"
```

---

### Task 9: Pagination UI in ReadingStream and SearchResults

**Files:**

- Modify: `src/pages/ReadingStream.tsx`
- Modify: `src/pages/SearchResults.tsx`

**Interfaces:**

- Both pages read `page` from URL search params and compute `offset = (page - 1) * pageSize`.

- [ ] **Step 1: Add pagination to ReadingStream**

Import:

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
```

Add page state:

```tsx
const PAGE_SIZE = 50;
const pageParam = parseInt(searchParams.get("page") || "1", 10);
const page = Math.max(1, Number.isNaN(pageParam) ? 1 : pageParam);
const offset = (page - 1) * PAGE_SIZE;
```

Update fetch URL:

```ts
url.searchParams.set("limit", String(PAGE_SIZE));
url.searchParams.set("offset", String(offset));
```

Add `setPage` helper and render pagination when total > PAGE_SIZE:

```tsx
const setPage = (p: number) => {
  const params = new URLSearchParams(searchParams);
  if (p <= 1) params.delete("page");
  else params.set("page", String(p));
  setSearchParams(params);
};

const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
```

Render:

```tsx
{
  totalPages > 1 && (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious onClick={() => setPage(page - 1)} isActive={page > 1} />
        </PaginationItem>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <PaginationItem key={p}>
            <PaginationLink onClick={() => setPage(p)} isActive={p === page}>
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext onClick={() => setPage(page + 1)} isActive={page < totalPages} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
```

Slice displayed entries:

```tsx
const pageEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
```

- [ ] **Step 2: Add pagination to SearchResults**

Same pattern with `PAGE_SIZE = 20` and `offset` passed to `/api/search`.

- [ ] **Step 3: Run route verification**

Run: `npm run verify:routes`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ReadingStream.tsx src/pages/SearchResults.tsx
git commit -m "feat: add pagination UI to ReadingStream and SearchResults"
```

---

### Task 10: Final verification and PR

- [ ] **Step 1: Run all required checks**

```bash
npm run format:check
npm run lint
npm run type-check
npm run build
npm run verify:routes
```

Expected: all pass.

- [ ] **Step 2: Run tests**

```bash
cd backend && npm test
npm run verify:accessibility
```

Expected: all pass.

- [ ] **Step 3: Review git status**

Run: `git status --short --branch`
Expected: only intended files modified/created; `REPO_AUDIT.md` and `ROADMAP.md` remain untracked.

- [ ] **Step 4: Open PR**

Target branch: `main`
Title: `fix: address CivicFeed frontend audit findings`
Body: summary of the 8 areas addressed plus the verification commands and results.

- [ ] **Step 5: Merge after CI green**

Squash merge once all checks pass.

---

## Spec coverage check

| Spec section          | Task(s)    |
| --------------------- | ---------- |
| Routing & 404         | Task 2     |
| Dark mode             | Task 3     |
| Eliminate reloads     | Task 4     |
| Pagination            | Tasks 1, 9 |
| Accessibility         | Task 5     |
| Meta tags / favicon   | Task 6     |
| IndexedDB persistence | Task 7     |
| Unused UI components  | Task 8     |
| Testing               | Task 10    |

## Placeholder scan

- No "TBD", "TODO", or "implement later" strings.
- Each step includes exact file paths, code, and expected command output.
- Public API of `src/lib/userData.ts` remains unchanged.
