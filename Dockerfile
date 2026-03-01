FROM node:20-alpine AS base

# Install dependencies needed for better-sqlite3 native compilation
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# ── Install deps ──────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ── Build ─────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dummy env vars so the build doesn't fail without real secrets
ENV GROQ_API_KEY=build_placeholder
ENV AUTH_PASSWORD=build_placeholder
ENV SESSION_SECRET=build_placeholder
ENV NODE_ENV=production

RUN npm run build

# ── Run ───────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The SQLite DB lives on a mounted volume at /data
# We point brain.db there via the DB_PATH env var
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
