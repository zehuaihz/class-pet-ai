FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The repo has no public/ directory, and Next does not create one, so the
# runner's COPY --from=builder /app/public would fail without this.
RUN mkdir -p public
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
USER nextjs
EXPOSE 3000
# Migrations are NOT run here: the Prisma CLI is a devDependency and is absent
# from this image, so `npx prisma` would try to download a different major from
# the registry. Run them from the `worker` image via the `migrate` compose
# service instead, and let multiple web replicas start without racing.
CMD ["node", "server.js"]

# AI jobs are processed by a long-running poller, not by the web process, so it
# ships as its own image target running the same commit.
FROM builder AS worker
WORKDIR /app
ENV NODE_ENV=production
CMD ["npm", "run", "worker"]
