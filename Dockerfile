# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
# Use --prefer-offline if cache mount available; skip optional peer deps
RUN npm ci --frozen-lockfile --prefer-offline

# ── Stage 2: Build the Next.js app ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Force Webpack (not Turbopack) for production builds — Turbopack is dev-only
# and extremely slow/unstable in CI/Docker environments.
ENV NEXT_PRIVATE_SKIP_TURBOPACK=1
ENV NEXT_PUBLIC_WS_PORT=3004
ENV NEXT_PUBLIC_BASE_PATH=/sattracker
ENV NEXT_PUBLIC_WS_PATH=/trackerws
ENV IS_BUILD=true

RUN npm run build

# ── Stage 3: Production runtime (minimal) ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3003
ENV WS_PORT=3004
ENV NEXT_PUBLIC_BASE_PATH=/sattracker
ENV NEXT_PUBLIC_WS_PATH=/trackerws

RUN addgroup --system --gid 1001 nodejs && \

    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public            ./public
COPY --from=builder /app/.next/standalone  ./
COPY --from=builder /app/.next/static      ./.next/static
COPY --from=builder /app/active-satellites-cache.json ./active-satellites-cache.json

USER nextjs

EXPOSE 3003
EXPOSE 3004

CMD ["node", "server.js"]

