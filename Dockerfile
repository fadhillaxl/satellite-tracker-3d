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

RUN npm run build

# ── Stage 3: Production runtime (minimal) ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public            ./public
COPY --from=builder /app/.next/standalone  ./
COPY --from=builder /app/.next/static      ./.next/static
COPY --from=builder /app/active-satellites-cache.json ./active-satellites-cache.json

USER nextjs

EXPOSE 3000
EXPOSE 3002

CMD ["node", "server.js"]
