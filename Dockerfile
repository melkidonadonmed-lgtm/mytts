# Multi-stage build for MyTTS (DialecticPod + FastChunks)
FROM node:22-slim AS builder

WORKDIR /app

# Install all dependencies for build
COPY package*.json ./
RUN npm ci

# Copy sources and compile Vite client
COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies and FFmpeg for studio broadcast audio mixing
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets and server application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/mockup_tatil_referencia.html ./mockup_tatil_referencia.html

# Run as non-root user
USER node

EXPOSE 8080

CMD ["npm", "start"]
