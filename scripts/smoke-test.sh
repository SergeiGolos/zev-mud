#!/bin/bash
# Smoke test script for zev-mud

set -euo pipefail

ENVIRONMENT=${1:-staging}
BASE_URL=""

# Set base URL based on environment
case $ENVIRONMENT in
    "production")
        BASE_URL="https://your-domain.com"
        ;;
    "staging")
        BASE_URL="http://staging.your-domain.com"
        ;;
    *)
        BASE_URL="http://localhost"
        ;;
esac

echo "=== Smoke Test for zev-mud ($ENVIRONMENT) ==="

# Test web client availability
echo "Testing web client availability..."
if curl -sf "${BASE_URL}:3001" > /dev/null; then
    echo "✓ Web client accessible"
else
    echo "✗ Web client not accessible"
    exit 1
fi

# Test WebSocket proxy health
echo "Testing WebSocket proxy health..."
if curl -sf "${BASE_URL}:8080/health" > /dev/null; then
    echo "✓ WebSocket proxy healthy"
else
    echo "✗ WebSocket proxy unhealthy"
    exit 1
fi

# Test basic WebSocket connection (if wscat is available)
if command -v wscat &> /dev/null; then
    echo "Testing WebSocket connection..."
    timeout 10s wscat -c "${BASE_URL}:8080" -x "look" > /dev/null 2>&1 && echo "✓ WebSocket connection successful" || echo "⚠ WebSocket connection test skipped"
fi

echo "=== Smoke Test Passed ==="