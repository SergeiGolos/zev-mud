FROM node:18-alpine

WORKDIR /app

# Install system dependencies for testing
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    netcat-openbsd \
    wget

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy test files
COPY . .

# Create test data directories
RUN mkdir -p /app/test-data /app/coverage

# Set permissions
RUN chmod +x scripts/*.js

EXPOSE 9229

CMD ["npm", "test"]