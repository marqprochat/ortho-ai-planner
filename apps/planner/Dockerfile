FROM node:20-alpine AS builder

WORKDIR /app

# Add build arguments for environment variables
ARG VITE_API_URL
ARG VITE_OPENAI_API_KEY
ARG VITE_GEMINI_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_OPENAI_API_KEY=$VITE_OPENAI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN node node_modules/vite/bin/vite.js build

# Final stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
