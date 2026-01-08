FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

# Cache bust - change this value to force rebuild
ARG CACHE_BUST=2026010715
RUN echo "Cache bust: $CACHE_BUST"

COPY . .
RUN node node_modules/typescript/bin/tsc

# Final stage
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

COPY start.sh .
RUN chmod +x start.sh

EXPOSE 3000

CMD ["/bin/sh", "start.sh"]
