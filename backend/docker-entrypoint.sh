#!/bin/sh
set -e

DB_PATH="${CIVICFEED_DB_PATH:-/app/data/civicfeed.db}"

echo "[entrypoint] Syncing feed catalog into $DB_PATH..."
node dist/db.js --seed

exec "$@"
