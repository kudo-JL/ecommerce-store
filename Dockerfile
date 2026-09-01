# E-commerce Store — Dockerfile for Coolify
# Optimized for Node 22 (uses built-in node:sqlite)

FROM node:22-alpine

WORKDIR /app

# Install system dependencies (for sharp/cheerio if needed)
RUN apk add --no-cache curl

# Copy package files first (better layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Create data directories (will be overwritten by persistent volume)
RUN mkdir -p data data/uploads

# Initialize database (creates tables in data/store.db)
RUN npm run init-db

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
