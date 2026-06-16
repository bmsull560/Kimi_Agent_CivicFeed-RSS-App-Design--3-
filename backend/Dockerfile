# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Native toolchain required to compile better-sqlite3
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies, keep the compiled native better-sqlite3 binding
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    CIVICFEED_DB_PATH=/app/data/civicfeed.db
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Persistent data dir for the SQLite database, owned by the unprivileged node user
RUN mkdir -p /app/data \
    && chmod +x /app/docker-entrypoint.sh \
    && chown -R node:node /app

USER node
EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
