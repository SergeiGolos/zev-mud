# Deployment Guide - zev-mud

This guide covers deployment strategies and operational procedures for the zev-mud browser-based MUD system.

## Quick Deployment

### Development Environment

```bash
# Clone and start development environment
git clone https://github.com/SergeiGolos/zev-mud.git
cd zev-mud
docker compose -f docker-compose.dev.yml up --build
```

**Access URLs:**
- Game Interface: http://localhost:3001
- Proxy Health: http://localhost:8080/health  
- Direct Telnet: telnet localhost 3000

### Production Deployment

```bash
# Production deployment
docker compose up --build -d

# Monitor deployment
docker compose ps
docker compose logs -f
```

## Production Setup

### Prerequisites

**System Requirements:**
- Docker Engine 20.10+
- Docker Compose v2+
- 2GB RAM minimum, 4GB recommended
- 10GB disk space for data persistence
- Network ports 3000, 3001, 8080 available

**Operating System:**
- Ubuntu 20.04+ (recommended)
- CentOS 8+
- Docker Desktop (Windows/Mac development)

### Environment Configuration

Create production environment file:

```bash
# .env.prod
NODE_ENV=production

# Ranvier Configuration
RANVIER_PORT=3000
RANVIER_LOG_LEVEL=info
DATA_PATH=/app/data

# Proxy Configuration  
WS_PORT=8080
WS_HOST=0.0.0.0
TELNET_HOST=ranvier
TELNET_PORT=3000
CONNECTION_TIMEOUT=30000
MAX_CONNECTIONS=100

# Web Client Configuration
WEB_CLIENT_PORT=3001
```

### SSL/TLS Configuration

For production with HTTPS/WSS:

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - web-client
      - proxy

  web-client:
    build: ./web-client
    expose:
      - "3001"
    environment:
      - PORT=3001
      - NODE_ENV=production

  proxy:
    build: ./proxy  
    expose:
      - "8080"
    environment:
      - WS_PORT=8080
      - TELNET_HOST=ranvier
    depends_on:
      - ranvier

  ranvier:
    build: ./ranvier
    expose:
      - "3000"
    volumes:
      - ranvier_data:/app/data
    environment:
      - PORT=3000
      - NODE_ENV=production

volumes:
  ranvier_data:

networks:
  default:
    name: mud-network
```

**Nginx Configuration:**
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream web_client {
        server web-client:3001;
    }
    
    upstream websocket_proxy {
        server proxy:8080;
    }

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name your-domain.com;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        location / {
            proxy_pass http://web_client;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        location /ws {
            proxy_pass http://websocket_proxy;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

## Container Management

### Health Monitoring

**Automated Health Checks:**
```bash
#!/bin/bash
# health-check.sh

services=("web-client" "proxy" "ranvier")
for service in "${services[@]}"; do
    if [ "$service" == "ranvier" ]; then
        # Check Telnet port
        nc -zv localhost 3000 >/dev/null 2>&1
    else
        # Check HTTP health endpoint
        curl -f http://localhost:${service}:${port}/health >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        echo "$service: healthy"
    else
        echo "$service: unhealthy" >&2
        exit 1
    fi
done
```

**Service Monitoring:**
```bash
# Monitor service status
docker compose ps

# View logs
docker compose logs -f [service-name]

# Resource usage
docker stats

# Health check endpoints
curl http://localhost:3001/health  # Web client
curl http://localhost:8080/health  # Proxy
nc -zv localhost 3000              # Ranvier
```

### Backup Procedures

**Character Data Backup:**
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/zev-mud"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.tar.gz"

mkdir -p $BACKUP_DIR

# Backup character data
docker compose exec ranvier tar -czf - /app/data > $BACKUP_FILE

# Verify backup
if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_FILE"
    
    # Cleanup old backups (keep 30 days)
    find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete
else
    echo "Backup failed!" >&2
    exit 1
fi
```

**Configuration Backup:**
```bash
# Backup all configuration files
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
    docker-compose*.yml \
    .env* \
    nginx.conf \
    ranvier/bundles/basic-world/
```

### Restoration

**Restore Character Data:**
```bash
# Stop services
docker compose down

# Restore data
docker compose run --rm ranvier tar -xzf /backup/backup_20240101_120000.tar.gz -C /

# Start services
docker compose up -d
```

## Performance Tuning

### Resource Allocation

**Container Limits:**
```yaml
# docker-compose.yml resource limits
services:
  ranvier:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'

  proxy:
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.3'

  web-client:
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: '0.2'
```

### Database Optimization

**NeDB Performance:**
```javascript
// ranvier/src/database-config.js
const config = {
  // Compact database files regularly
  autoCompactionInterval: 30000,  // 30 seconds
  
  // Index frequently queried fields
  ensureIndex: [
    { fieldName: 'name', unique: true },
    { fieldName: 'lastLogin' }
  ]
};
```

### Connection Scaling

**Proxy Configuration for High Load:**
```javascript
// proxy/config/production.js
module.exports = {
  maxConnections: 200,        // Increase connection limit
  connectionTimeout: 60000,   // Longer timeout for stability
  keepAliveInterval: 30000,   // Regular keepalive pings
  maxMessageSize: 8192,       // Larger message buffer
  
  // Connection pool for Telnet
  telnetPool: {
    min: 5,                   // Minimum connections
    max: 50,                  // Maximum connections
    acquireTimeout: 10000     // Connection acquire timeout
  }
};
```

## Security Hardening

### Network Security

**Firewall Configuration:**
```bash
# UFW firewall rules
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow MUD ports (if needed for direct telnet)
ufw allow from 192.168.0.0/16 to any port 3000

ufw enable
```

**Container Security:**
```dockerfile
# Dockerfile security enhancements
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S mud && \
    adduser -S mud -u 1001

# Set security headers
USER mud

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1
```

### Application Security

**Input Validation:**
```javascript
// Sanitize user input
const sanitizeInput = (input) => {
  return input
    .replace(/[<>]/g, '')      // Remove HTML tags
    .slice(0, 1000)            // Limit length
    .trim();                   // Remove whitespace
};
```

**Rate Limiting:**
```javascript
// proxy/src/rate-limiter.js
const rateLimit = {
  windowMs: 60000,        // 1 minute window
  maxRequests: 100,       // Max 100 commands per minute
  skipSuccessfulRequests: false,
  
  // Custom handler
  handler: (connection) => {
    connection.send('You are sending commands too quickly. Please slow down.\n');
  }
};
```

## Monitoring & Logging

### Log Management

**Centralized Logging:**
```yaml
# docker-compose.yml logging configuration
services:
  ranvier:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        
  proxy:
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://loghost:514"
        tag: "zev-mud-proxy"
```

**Log Rotation:**
```bash
# /etc/logrotate.d/zev-mud
/var/log/zev-mud/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 644 mud mud
    postrotate
        docker compose restart proxy ranvier web-client
    endscript
}
```

### Metrics Collection

**Basic Metrics Script:**
```bash
#!/bin/bash
# metrics.sh

echo "=== zev-mud System Metrics ==="
echo "Date: $(date)"
echo

echo "Container Status:"
docker compose ps

echo "Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo "Active Connections:"
curl -s http://localhost:8080/health | jq '.activeConnections'

echo "Disk Usage:"
df -h /var/lib/docker/volumes/
```

## Troubleshooting

### Common Deployment Issues

**Port Conflicts:**
```bash
# Check port usage
sudo netstat -tulpn | grep -E ':(3000|3001|8080)'

# Kill processes using ports
sudo fuser -k 3000/tcp
```

**Container Startup Issues:**
```bash
# Debug container startup
docker compose up --no-deps ranvier
docker compose logs ranvier

# Check container health
docker inspect zev-mud-ranvier | jq '.[0].State.Health'
```

**Database Connection Issues:**
```bash
# Check data volume
docker volume inspect zev-mud_ranvier_data

# Verify database files
docker compose exec ranvier ls -la /app/data/
```

### Performance Issues

**High Memory Usage:**
```bash
# Monitor memory over time
while true; do
    echo "$(date): $(docker stats --no-stream --format 'table {{.Container}}\t{{.MemUsage}}' | grep zev-mud)"
    sleep 60
done
```

**Connection Issues:**
```bash
# Debug WebSocket connections
docker compose exec proxy ss -tulpn

# Test connectivity between services
docker compose exec web-client nc -zv proxy 8080
docker compose exec proxy nc -zv ranvier 3000
```

This deployment guide provides comprehensive coverage for running zev-mud in production environments with proper security, monitoring, and maintenance procedures.