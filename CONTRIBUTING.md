# Contributing to CivicFeed

Thank you for your interest in contributing. This document covers setup, workflow, and quality expectations.

## Development setup

1. Clone the repository.
2. Install root dependencies:
   ```bash
   npm ci
   ```
3. Install backend dependencies:
   ```bash
   cd backend && npm ci
   ```

## Running the app locally

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend (from the repository root):

```bash
npm run dev
```

The frontend expects the backend to be running on its default port.

## Quality checks

Run these before opening a pull request:

```bash
npm run lint
npm run format:check
npm run type-check
npm run build
cd backend && npm run lint
cd backend && npm run type-check
cd backend && npm test
```

To auto-format files:

```bash
npm run format
```

## Pull request workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-change
   ```
2. Make focused, reviewable commits with conventional commit messages.
3. Ensure all quality checks pass locally.
4. Push your branch and open a pull request against `main`.
5. Keep the branch up to date with `main` and address review feedback.

## Scope and conventions

- Follow the architectural constraints in `AGENTS.md`.
- The backend owns RSS fetching, parsing, caching, and the feed catalog.
- The frontend consumes backend APIs; do not add client-side RSS fetching or public CORS proxies.
- Avoid `any`; use strict TypeScript types.
- Add tests for new behavior and keep existing tests green.

## Security

See `SECURITY.md` for vulnerability reporting and security practices.

## Getting help

Open a discussion or issue for questions before starting large changes.
