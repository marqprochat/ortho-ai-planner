FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN chmod -R +x node_modules/.bin

COPY prisma ./prisma
RUN npx prisma generate

# Cache bust - change this value to force rebuild
ARG CACHE_BUST=202602111130
RUN echo "Cache bust: $CACHE_BUST"

COPY . .
RUN npx prisma generate
RUN node node_modules/typescript/bin/tsc

# Final stage
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

COPY start.sh .
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh
RUN chmod -R +x node_modules/.bin

EXPOSE 3000

CMD ["/bin/sh", "start.sh"]
