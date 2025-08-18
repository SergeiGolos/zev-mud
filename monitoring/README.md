# Monitoring Stack for zev-mud

This directory contains monitoring and observability configurations for zev-mud.

## Components

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization dashboards  
- **AlertManager**: Alert routing and management
- **Exporters**: Custom metrics exporters for application monitoring

## Directory Structure

```
monitoring/
├── prometheus/
│   ├── prometheus.yml       # Prometheus configuration
│   ├── alerts.yml           # Alerting rules
│   └── rules.yml            # Recording rules
├── grafana/
│   ├── dashboards/         # Grafana dashboards
│   └── datasources.yml     # Data source configuration
└── exporters/
    ├── node-exporter.yml   # Node metrics
    └── app-exporter.yml    # Application metrics
```

## Setup

1. **Deploy monitoring stack**:
   ```bash
   kubectl apply -f monitoring/
   ```

2. **Access Grafana**:
   ```bash
   kubectl port-forward svc/grafana 3000:3000 -n monitoring
   # Open http://localhost:3000
   ```

## Key Metrics

- **Application Performance**: Response time, throughput, error rates
- **Infrastructure**: CPU, memory, disk, network utilization  
- **Business Metrics**: Active connections, user sessions, game events
- **System Health**: Service availability, dependency health

## Alerts

Critical alerts are configured for:
- Service downtime
- High error rates
- Resource exhaustion
- Database connection issues
- Security incidents