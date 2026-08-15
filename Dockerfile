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
# 全局安装与 schema 匹配的 Prisma CLI（自包含其全部传递依赖，如 @prisma/config → effect/c12 等）。
# 必须使用 6.x：npx 会自动拉取最新 Prisma 7，而 7 已移除 schema 中的 datasource url 语法。
# 版本需与 package.json 中的 prisma 保持一致。
RUN npm install -g prisma@6.19.3
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
EXPOSE 3000
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
