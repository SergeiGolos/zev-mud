#!/bin/bash
# Health check script for zev-mud services

set -euo pipefail

ENVIRONMENT=${1:-staging}
COLOR=${2:-blue}

echo "=== Health Check for zev-mud ($ENVIRONMENT) ==="

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local service=$2
    
    if curl -sf "$url" > /dev/null 2>&1; then
        echo "✓ $service - Healthy"
        return 0
    else
        echo "✗ $service - Failed"
        return 1
    fi
}

# Function to check TCP port
check_tcp() {
    local host=$1
    local port=$2
    local service=$3
    
    if nc -z "$host" "$port" > /dev/null 2>&1; then
        echo "✓ $service - Port $port accessible"
        return 0
    else
        echo "✗ $service - Port $port not accessible"
        return 1
    fi
}

# Set URLs based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    WEB_CLIENT_URL="https://your-domain.com/health"
    PROXY_URL="https://your-domain.com/ws/health"
    RANVIER_HOST="ranvier-service"
elif [ "$ENVIRONMENT" = "staging" ]; then
    WEB_CLIENT_URL="http://staging.your-domain.com/health"
    PROXY_URL="http://staging.your-domain.com/ws/health"
    RANVIER_HOST="ranvier-service"
else
    # Local/development
    WEB_CLIENT_URL="http://localhost:3001/health"
    PROXY_URL="http://localhost:8080/health"
    RANVIER_HOST="localhost"
fi

# Perform health checks
FAILED=0

echo "Checking web client..."
check_http "$WEB_CLIENT_URL" "Web Client" || FAILED=$((FAILED + 1))

echo "Checking proxy service..."
check_http "$PROXY_URL" "Proxy Service" || FAILED=$((FAILED + 1))

echo "Checking Ranvier MUD server..."
check_tcp "$RANVIER_HOST" 3000 "Ranvier Server" || FAILED=$((FAILED + 1))

# Summary
echo "=== Health Check Summary ==="
if [ $FAILED -eq 0 ]; then
    echo "✓ All health checks passed"
    exit 0
else
    echo "✗ $FAILED health checks failed"
    exit 1
fi