# CivicFeed Frontend Audit Remediation Design

Date: 2026-07-12
Target: CivicFeed React frontend (`src/`, `index.html`, `vite.config.ts`, `nginx.conf`)

## Objective

Address all findings from the Manus AI frontend audit in a single focused PR while preserving existing behavior, avoiding scope creep, and keeping the diff reviewable through logical commits.

## Findings and planned changes

### 1. Routing & 404 handling

**Finding:** The app uses `HashRouter` and has no catch-all 404 route.

**Changes:**

- Switch `src/main.tsx` from `HashRouter` to `BrowserRouter`.
- Add `<Route path="*" element={<NotFound />} />` in `src/App.tsx`.
- Create `src/pages/NotFound.tsx` with a return-to-dashboard link.
- Replace `window.location.hash = "#/feeds"` in `src/pages/ReadingStream.tsx` with `navigate("/feeds")`.
- Change `vite.config.ts` `base` from `"./"` to `"/"` and enable `historyApiFallback` for dev parity.
- `nginx.conf` already contains `try_files $uri $uri/ /index.html;`, so no production server change is required.

### 2. Dark mode

**Finding:** `next-themes` is installed but no `.dark` variables exist; dark mode is non-functional.

**Changes:**

- Wrap the app in `next-themes` `ThemeProvider` in `src/main.tsx` with `attribute="class"`.
- Add a complete `.dark` color block to `src/index.css` that mirrors `:root` variables using slate/zinc dark values.
- Add a theme toggle button in `src/components/Header.tsx` using `useTheme`.
- Replace hardcoded `bg-white` / `text-slate-900` surfaces in `Layout`, `Header`, and `Sidebar` with theme-aware variables where they break in dark mode.

### 3. Eliminate full-page reloads

**Finding:** `ErrorBoundary.tsx` and `Dashboard.tsx` use `window.location.reload()` for recovery.

**Changes:**

- `ErrorBoundary`: accept a `resetKey` prop and provide a "Try Again" button that resets internal state instead of reloading.
- `Dashboard`: change `handleRefreshAll` to call `refresh()` only and remove `window.location.reload()`.

### 4. Pagination

**Finding:** `ReadingStream` fetches `limit=200` and `SearchResults` fetches `limit=50` with no pagination UI.

**Changes:**

- Backend (`backend/src/server.ts`): add optional `offset` query parameter to `/api/search` and `/api/articles/recent`.
- Backend (`backend/src/search.ts`): add `offset` support to `searchArticles()` and `getRecentArticles()`.
- Frontend: integrate the existing `src/components/ui/pagination.tsx` in `ReadingStream` and `SearchResults`.
- Default page sizes: 20 for search, 50 for reading stream (matching current backend defaults).

### 5. Accessibility improvements

**Findings:** Missing skip link, no footer landmark, search input lacks a visible label, minor heading hierarchy issues.

**Changes:**

- Add a visually hidden "Skip to main content" link in `Layout.tsx` that moves focus to `<main>`.
- Add a `<footer>` landmark in `Layout.tsx`.
- Add a visible `<label htmlFor="global-search">` in `Header.tsx`; keep `aria-label` as fallback.
- Fix heading hierarchy: change `CategoryCard` heading from `<h3>` to `<h2>`, and adjust `FeedStatusPanel` heading level where it appears under an existing `<h2>`.

### 6. Meta tags & favicon

**Finding:** `index.html` lacks Open Graph tags and a favicon.

**Changes:**

- Add `og:title`, `og:description`, `og:type`, `og:url`, and `theme-color` meta tags to `index.html`.
- Add a generated SVG favicon and link it in `index.html`.

### 7. localStorage → IndexedDB migration

**Finding:** User state is persisted in `localStorage`, risking quota limits as read/bookmarked/archive lists grow.

**Changes:**

- Add `idb-keyval` dependency.
- Refactor `src/lib/userData.ts` to read/write from IndexedDB while preserving the same public API.
- Keep `localStorage` as a transparent fallback for private-mode or quota failures.

### 8. Unused UI component cleanup

**Finding:** Many `src/components/ui/` components are unused.

**Changes:**

- Remove components with zero imports across the codebase.
- Retain components that are imported or will be used after these changes: button, dialog, dropdown-menu, input, label, pagination, select, separator, sheet, skeleton, sonner, switch, textarea, toggle, tooltip.

## Architecture

- The app remains a React SPA consuming the backend API.
- State management stays client-side; only the persistence layer moves from `localStorage` to IndexedDB.
- Pagination is cursor/offset-based via query parameters, not a new state library.
- Dark mode is class-based (`dark` class on `<html>`) driven by `next-themes`.

## Error handling

- IndexedDB failures fall back to in-memory defaults and log a warning; `localStorage` remains a secondary fallback.
- Backend pagination errors are handled by the existing fetch retry loops in the frontend.

## Testing

Required checks before declaring the PR complete:

- `npm run format:check`
- `npm run lint`
- `npm run type-check`
- `npm run build`
- `npm run verify:routes`
- Playwright smoke and accessibility tests
- Manual verification of dark mode toggle, 404 page, pagination, and skip link

## Risks and mitigations

| Risk                                                  | Mitigation                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Deleting unused UI components breaks a future feature | Only remove components with zero current imports; they can be re-added with `npx shadcn add` if needed. |
| BrowserRouter breaks direct links in dev              | Vite dev server `historyApiFallback` will be enabled.                                                   |
| IndexedDB not available in some environments          | Fallback to `localStorage`, then to in-memory defaults.                                                 |
| Dark mode colors clash with existing components       | Use the existing blue/slate semantic tokens; update only the most visible surfaces first.               |

## Rollback

Revert the PR to restore `HashRouter`, `localStorage` persistence, removed components, and previous styling.
