FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN mkdir -p /app/public
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Prisma CLI（迁移用）：prisma 在 devDependencies，standalone 输出不含它。
# 必须复制仓库锁定的版本（6.x），否则 CMD 里的 npx 会拉取最新 Prisma 7，
# 而 7 已移除 schema 中的 datasource url 语法，导致 migrate deploy 失败。
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
EXPOSE 3000
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
