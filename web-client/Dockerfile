# Multi-stage build for web client
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    wget \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
RUN mkdir -p logs certs
EXPOSE 3001 3443
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci --include=dev
COPY . .
RUN npm run build 2>/dev/null || echo "No build script found, using source files directly"

# Production dependencies stage
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S webclient -u 1001 -G nodejs

# Copy production dependencies
COPY --from=deps --chown=webclient:nodejs /app/node_modules ./node_modules

# Copy built application or source files
COPY --from=build --chown=webclient:nodejs /app/dist ./dist 2>/dev/null || \
COPY --chown=webclient:nodejs . .

# Create necessary directories with proper permissions
RUN mkdir -p logs certs public && \
    chown -R webclient:nodejs logs certs public

# Switch to non-root user
USER webclient

# Expose HTTP and HTTPS ports
EXPOSE 3001 3443

# Health check endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]