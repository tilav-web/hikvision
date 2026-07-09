# ─────────────────────────────────────────────────────────────
# Hikvision server — multi-stage Docker build
# Stage 1: build (dev dependencies bilan TypeScript → dist)
# Stage 2: runtime (faqat prod dependencies, kichik image)
# ─────────────────────────────────────────────────────────────

# ---- Stage 1: builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Avval faqat manifestlar — Docker layer cache samarali bo'lsin
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Faqat prod dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Build natijasi
COPY --from=builder /app/dist ./dist

# Yuz rasmlari / event snapshotlari uchun (volume bilan mount qilinadi).
# `node` user yoza olishi uchun egalikni beramiz (named volume shu egalikni oladi).
RUN mkdir -p uploads && chown -R node:node /app/uploads

EXPOSE 3000

# Konteyner ichida root emas — xavfsizroq
USER node

CMD ["node", "dist/main"]
