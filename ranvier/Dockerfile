# Multi-stage build for Ranvier MUD server
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    netcat-openbsd \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
RUN mkdir -p data logs
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production dependencies stage
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ranvier -u 1001 -G nodejs

# Copy production dependencies
COPY --from=deps --chown=ranvier:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=ranvier:nodejs . .

# Create necessary directories with proper permissions
RUN mkdir -p data logs areas bundles && \
    chown -R ranvier:nodejs data logs areas bundles

# Switch to non-root user
USER ranvier

# Expose telnet port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD nc -z localhost 3000 || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]