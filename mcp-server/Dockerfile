FROM node:20-alpine AS builder

WORKDIR /app

COPY mcp-server/package*.json ./mcp-server/
COPY backend/package*.json ./backend/

WORKDIR /app/mcp-server
RUN npm install

WORKDIR /app
COPY backend/prisma ./backend/prisma
COPY backend/src/lib/dentist.ts ./backend/src/lib/dentist.ts
COPY backend/src/lib/dentistMatcher.ts ./backend/src/lib/dentistMatcher.ts
COPY mcp-server ./mcp-server

WORKDIR /app/mcp-server
RUN npx prisma generate --schema=../backend/prisma/schema.prisma
RUN node -e "require('fs').cpSync('../backend/node_modules/.prisma', './node_modules/.prisma', { recursive: true })" || true
RUN npx tsc

FROM node:20-alpine AS runner

WORKDIR /app/mcp-server

COPY --from=builder /app/mcp-server/dist ./dist
COPY --from=builder /app/mcp-server/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/mcp-server/package*.json ./

ENV MCP_TRANSPORT=sse
ENV MCP_PORT=3001
EXPOSE 3001

CMD ["node", "dist/mcp-server/src/index.js", "--sse"]
