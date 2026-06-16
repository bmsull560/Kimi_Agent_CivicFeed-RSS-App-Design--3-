#!/bin/sh
set -e

DB_PATH="${CIVICFEED_DB_PATH:-/app/data/civicfeed.db}"

if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] No database found at $DB_PATH — seeding feeds..."
  node dist/db.js --seed
else
  echo "[entrypoint] Existing database found at $DB_PATH — skipping seed."
fi

exec "$@"
