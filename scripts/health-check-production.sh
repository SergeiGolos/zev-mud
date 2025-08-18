#!/bin/bash

# Production health check script
# Monitors all services and reports status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${1:-localhost}"
HTTP_PORT="${2:-80}"
HTTPS_PORT="${3:-443}"
WEB_PORT="${4:-3001}"
PROXY_PORT="${5:-8080}"
RANVIER_PORT="${6:-3000}"

echo "🏥 Production Health Check for $DOMAIN"
echo "========================================"

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local name=$2
    local timeout=${3:-5}
    
    if curl -s --max-time $timeout "$url" > /dev/null 2>&1; then
        echo -e "✅ $name: ${GREEN}HEALTHY${NC}"
        return 0
    else
        echo -e "❌ $name: ${RED}UNHEALTHY${NC}"
        return 1
    fi
}

# Function to check TCP port
check_tcp() {
    local host=$1
    local port=$2
    local name=$3
    local timeout=${4:-5}
    
    if timeout $timeout bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "✅ $name: ${GREEN}HEALTHY${NC}"
        return 0
    else
        echo -e "❌ $name: ${RED}UNHEALTHY${NC}"
        return 1
    fi
}

# Function to check Docker service
check_docker_service() {
    local service=$1
    local name=$2
    
    if docker-compose ps -q $service | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
        echo -e "✅ $name: ${GREEN}HEALTHY${NC}"
        return 0
    else
        local status=$(docker-compose ps -q $service | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "not found")
        echo -e "❌ $name: ${RED}$status${NC}"
        return 1
    fi
}

# Function to check SSL certificate
check_ssl_cert() {
    local domain=$1
    local port=$2
    
    local expiry=$(echo | openssl s_client -servername $domain -connect $domain:$port 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo 0)
    local current_epoch=$(date +%s)
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    if [ $days_until_expiry -gt 30 ]; then
        echo -e "✅ SSL Certificate: ${GREEN}Valid for $days_until_expiry days${NC}"
        return 0
    elif [ $days_until_expiry -gt 0 ]; then
        echo -e "⚠️  SSL Certificate: ${YELLOW}Expires in $days_until_expiry days${NC}"
        return 1
    else
        echo -e "❌ SSL Certificate: ${RED}EXPIRED${NC}"
        return 1
    fi
}

# Initialize counters
total_checks=0
failed_checks=0

echo ""
echo "🐳 Docker Services"
echo "------------------"

# Check Docker services
services=("ranvier:Ranvier Server" "proxy:WebSocket Proxy" "web-client:Web Client" "nginx:Nginx Reverse Proxy")
for service_info in "${services[@]}"; do
    IFS=':' read -r service name <<< "$service_info"
    total_checks=$((total_checks + 1))
    if ! check_docker_service "$service" "$name"; then
        failed_checks=$((failed_checks + 1))
    fi
done

echo ""
echo "🌐 HTTP/HTTPS Endpoints"
echo "----------------------"

# Check HTTP endpoints
endpoints=(
    "http://$DOMAIN:$HTTP_PORT/health:Nginx HTTP"
    "https://$DOMAIN:$HTTPS_PORT/health:Nginx HTTPS"
    "http://$DOMAIN:$WEB_PORT/health:Web Client HTTP"
    "http://$DOMAIN:$PROXY_PORT/health:WebSocket Proxy"
)

for endpoint_info in "${endpoints[@]}"; do
    IFS=':' read -r url name <<< "$endpoint_info"
    total_checks=$((total_checks + 1))
    if ! check_http "$url" "$name"; then
        failed_checks=$((failed_checks + 1))
    fi
done

echo ""
echo "🔌 TCP Connections"
echo "------------------"

# Check TCP connections
tcp_services=(
    "$DOMAIN:$RANVIER_PORT:Ranvier Telnet Server"
    "$DOMAIN:$PROXY_PORT:WebSocket Proxy"
    "$DOMAIN:$WEB_PORT:Web Client"
)

for tcp_info in "${tcp_services[@]}"; do
    IFS=':' read -r host port name <<< "$tcp_info"
    total_checks=$((total_checks + 1))
    if ! check_tcp "$host" "$port" "$name"; then
        failed_checks=$((failed_checks + 1))
    fi
done

echo ""
echo "🔒 SSL Certificate"
echo "------------------"

total_checks=$((total_checks + 1))
if ! check_ssl_cert "$DOMAIN" "$HTTPS_PORT"; then
    failed_checks=$((failed_checks + 1))
fi

echo ""
echo "📊 Resource Usage"
echo "-----------------"

# Check Docker resource usage
echo "Docker Container Stats:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | head -5

echo ""
echo "💾 Disk Usage:"
df -h | grep -E "(Filesystem|/dev/)" | head -2

echo ""
echo "🧠 Memory Usage:"
free -h

echo ""
echo "📈 Summary"
echo "----------"

success_rate=$(( (total_checks - failed_checks) * 100 / total_checks ))

if [ $failed_checks -eq 0 ]; then
    echo -e "🎉 All systems operational! ${GREEN}$success_rate% success rate${NC}"
    exit 0
elif [ $failed_checks -lt 3 ]; then
    echo -e "⚠️  Some issues detected. ${YELLOW}$success_rate% success rate${NC}"
    echo -e "   Failed checks: $failed_checks/$total_checks"
    exit 1
else
    echo -e "🚨 Multiple system failures! ${RED}$success_rate% success rate${NC}"
    echo -e "   Failed checks: $failed_checks/$total_checks"
    exit 2
fi