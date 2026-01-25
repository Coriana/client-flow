# Build stage for frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files
COPY . .

# Build frontend with API URL pointing to same origin (relative path)
ENV VITE_API_URL=/api
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies + tsx for running TypeScript
RUN npm ci --omit=dev && npm install tsx

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server source files (tsx will compile on-the-fly)
COPY server ./server

# Create data directory (will be overwritten by volume mount)
RUN mkdir -p /app/data /app/server/uploads

# Expose port
EXPOSE 3001

# Environment variables with defaults
ENV NODE_ENV=production
ENV API_PORT=3001
ENV DATABASE_PATH=/app/data/app.db
ENV JWT_SECRET=change-me-in-production
ENV CORS_ORIGIN=*

# Start the server using tsx
CMD ["npx", "tsx", "server/index.ts"]
