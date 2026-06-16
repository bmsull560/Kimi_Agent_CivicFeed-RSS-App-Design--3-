# CivicFeed

A single-page web app for browsing and reading U.S. government RSS feeds.

## Features

- **Dashboard** — Category overview with live feed previews
- **Feed Directory** — Searchable, filterable list of 505+ verified government RSS feeds
- **Feed Detail** — Read latest entries from any feed with client-side caching

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v3
- shadcn/ui components
- React Router (HashRouter)

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on port 3000.

## Build

```bash
npm run build
```

Static output is written to `dist/`.

## Docker

Run the full stack (frontend + backend API + seeded SQLite database) with Docker Compose:

```bash
docker compose up --build
```

- Frontend: http://localhost:8080
- API health: http://localhost:8080/api/health

The backend seeds its database on first run and persists it in the `civicfeed-data` volume. To stop and remove the containers:

```bash
docker compose down
```

The frontend image builds the Vite SPA and serves it via nginx, which also proxies `/api/` requests to the backend service.
