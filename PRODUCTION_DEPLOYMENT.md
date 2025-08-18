# Production Deployment Guide

This guide covers deploying the Ranvier MUD Browser Client system in a production environment with SSL/TLS, monitoring, and optimized configurations.

## Prerequisites

- Docker and Docker Compose installed
- Domain name configured (for SSL certificates)
- Sufficient system resources (minimum 2GB RAM, 2 CPU cores)
- OpenSSL installed (for certificate generation)

## Quick Start

1. **Clone and prepare the environment:**
   ```bash
   git clone <repository-url>
   cd zev-mud
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.production .env
   # Edit .env file with your specific configuration
   ```

3. **Generate SSL certificates (for development/testing):**
   ```bash
   # On Linux/macOS:
   ./scripts/generate-ssl-certs.sh your-domain.com
   
   # On Windows PowerShell:
   .\scripts\deploy-production.ps1 -Domain "your-domain.com" -GenerateCerts
   ```

4. **Deploy the application:**
   ```bash
   # Standard deployment
   docker-compose up -d
   
   # With monitoring stack
   docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml up -d
   ```

## Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# Service Ports
RANVIER_PORT=3000
PROXY_PORT=8080
PROXY_SSL_PORT=8443
WEB_PORT=3001
WEB_SSL_PORT=3443
HTTP_PORT=80
HTTPS_PORT=443

# SSL Configuration
SSL_ENABLED=true
SSL_CERT_PATH=/app/certs/cert.pem
SSL_KEY_PATH=/app/certs/key.pem

# Database Configuration
DB_TYPE=nedb
LOG_LEVEL=info
MAX_PLAYERS=50
```

### SSL/TLS Configuration

#### Development/Testing Certificates

Use the provided script to generate self-signed certificates:

```bash
./scripts/generate-ssl-certs.sh your-domain.com
```

#### Production Certificates

For production, use certificates from a trusted CA:

1. **Let's Encrypt (recommended):**
   ```bash
   # Install certbot
   sudo apt-get install certbot
   
   # Generate certificates
   sudo certbot certonly --standalone -d your-domain.com
   
   # Copy certificates to the certs directory
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./certs/cert.pem
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./certs/key.pem
   sudo chown $USER:$USER ./certs/*.pem
   ```

2. **Commercial CA certificates:**
   - Place your certificate file as `./certs/cert.pem`
   - Place your private key as `./certs/key.pem`
   - Ensure proper file permissions (600 for key, 644 for cert)

### Persistent Storage

The production configuration uses bind mounts for persistent data:

```yaml
volumes:
  ranvier_data:
    driver_opts:
      type: none
      o: bind
      device: ./data/ranvier
```

Create the required directories:
```bash
mkdir -p data/{ranvier,areas,bundles} logs/{ranvier,proxy,web,nginx} certs
```

## Deployment Options

### Standard Production Deployment

```bash
docker-compose up -d
```

This starts:
- Ranvier MUD server (port 3000)
- WebSocket-Telnet proxy (ports 8080, 8443)
- Web client (ports 3001, 3443)
- Nginx reverse proxy (ports 80, 443)
- Node exporter for monitoring (port 9100)

### Production with SSL Override

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Full Monitoring Stack

```bash
docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml up -d
```

This adds:
- Prometheus (port 9090)
- Grafana (port 3000)
- Loki (port 3100)
- Promtail (log collection)
- Alertmanager (port 9093)

## Service Architecture

```
Internet → Nginx (80/443) → Web Client (3001/3443)
                         → WebSocket Proxy (8080/8443) → Ranvier Server (3000)
```

### Service Health Checks

All services include comprehensive health checks:

- **Ranvier**: TCP connection test on port 3000
- **Proxy**: HTTP health endpoint check
- **Web Client**: HTTP health endpoint check
- **Nginx**: HTTP health endpoint check

### Resource Limits

Production deployment includes resource limits:

```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

## Monitoring and Logging

### Log Management

Logs are configured with rotation:
- Maximum file size: 50MB
- Maximum files: 5
- Structured JSON format
- Service labels for filtering

### Prometheus Metrics

Services expose metrics on `/metrics` endpoints:
- Connection counts
- Response times
- Error rates
- Resource usage

### Grafana Dashboards

Access Grafana at `http://your-domain:3000`:
- Default credentials: admin/admin
- Pre-configured dashboards for all services
- Real-time monitoring and alerting

## Security Considerations

### Container Security

- Non-root users in all containers
- Minimal base images (Alpine Linux)
- Security headers in Nginx configuration
- Rate limiting for API endpoints

### Network Security

- Internal Docker network for service communication
- Only necessary ports exposed to host
- SSL/TLS encryption for all external connections

### Data Protection

- Persistent volumes with proper permissions
- Database encryption at rest (configurable)
- Secure certificate storage

## Backup and Recovery

### Database Backup

```bash
# Create backup
docker-compose exec ranvier npm run backup

# Restore from backup
docker-compose exec ranvier npm run restore backup-file.json
```

### Configuration Backup

```bash
# Backup configuration and certificates
tar -czf mud-backup-$(date +%Y%m%d).tar.gz \
  .env docker-compose.yml certs/ data/ logs/
```

## Scaling and Performance

### Horizontal Scaling

For high-traffic deployments:

```yaml
deploy:
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
  restart_policy:
    condition: on-failure
```

### Performance Tuning

1. **Database optimization:**
   - Use PostgreSQL or MongoDB for production
   - Configure connection pooling
   - Enable query optimization

2. **Proxy optimization:**
   - Increase connection limits
   - Enable WebSocket compression
   - Configure load balancing

3. **Web client optimization:**
   - Enable gzip compression
   - Configure CDN for static assets
   - Implement caching strategies

## Troubleshooting

### Common Issues

1. **SSL Certificate errors:**
   ```bash
   # Check certificate validity
   openssl x509 -in certs/cert.pem -text -noout
   
   # Verify certificate chain
   openssl verify -CAfile certs/ca.pem certs/cert.pem
   ```

2. **Service connectivity issues:**
   ```bash
   # Check service logs
   docker-compose logs -f service-name
   
   # Test internal connectivity
   docker-compose exec proxy nc -zv ranvier 3000
   ```

3. **Performance issues:**
   ```bash
   # Monitor resource usage
   docker stats
   
   # Check service health
   docker-compose ps
   ```

### Log Analysis

```bash
# View all logs
docker-compose logs -f

# Filter by service
docker-compose logs -f ranvier

# Search for errors
docker-compose logs | grep ERROR
```

## Maintenance

### Updates

```bash
# Pull latest images
docker-compose pull

# Restart services with zero downtime
docker-compose up -d --no-deps service-name
```

### Certificate Renewal

```bash
# Renew Let's Encrypt certificates
sudo certbot renew

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem ./certs/
sudo chown $USER:$USER ./certs/*.pem

# Restart services
docker-compose restart nginx proxy web-client
```

## Support and Monitoring

### Health Endpoints

- Web Client: `http://your-domain:3001/health`
- Proxy: `http://your-domain:8080/health`
- Nginx: `http://your-domain/health`

### Monitoring URLs

- Prometheus: `http://your-domain:9090`
- Grafana: `http://your-domain:3000`
- Alertmanager: `http://your-domain:9093`

### Performance Metrics

Key metrics to monitor:
- Active player connections
- WebSocket message throughput
- Database query performance
- Memory and CPU usage
- SSL certificate expiration dates