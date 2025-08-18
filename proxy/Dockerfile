# Multi-stage build for WebSocket-Telnet proxy
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
EXPOSE 8080 8443
CMD ["npm", "run", "dev"]

# Production dependencies stage
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S proxy -u 1001 -G nodejs

# Copy production dependencies
COPY --from=deps --chown=proxy:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=proxy:nodejs src/ ./src/
COPY --chown=proxy:nodejs config/ ./config/
COPY --chown=proxy:nodejs package*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p logs certs && \
    chown -R proxy:nodejs logs certs

# Switch to non-root user
USER proxy

# Expose WebSocket ports (HTTP and HTTPS)
EXPOSE 8080 8443

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]