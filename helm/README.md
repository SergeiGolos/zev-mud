# Helm Chart for zev-mud

This directory contains Helm charts for deploying zev-mud to Kubernetes.

## Chart Structure

```
helm/
└── zev-mud/
    ├── Chart.yaml           # Chart metadata
    ├── values.yaml          # Default values
    ├── values-staging.yaml  # Staging environment overrides
    ├── values-production.yaml # Production environment overrides
    └── templates/
        ├── deployment.yaml  # Kubernetes deployments
        ├── service.yaml     # Kubernetes services
        ├── ingress.yaml     # Ingress configuration
        ├── configmap.yaml   # Configuration maps
        ├── secrets.yaml     # Secrets management
        └── hpa.yaml         # Horizontal Pod Autoscaler
```

## Installation

1. **Add Helm Repository** (if publishing to a repo):
   ```bash
   helm repo add zev-mud https://charts.your-domain.com
   ```

2. **Install Chart**:
   ```bash
   # Development
   helm install zev-mud ./helm/zev-mud
   
   # Staging
   helm install zev-mud ./helm/zev-mud --values ./helm/zev-mud/values-staging.yaml
   
   # Production
   helm install zev-mud ./helm/zev-mud --values ./helm/zev-mud/values-production.yaml
   ```

3. **Upgrade Chart**:
   ```bash
   helm upgrade zev-mud ./helm/zev-mud --values ./helm/zev-mud/values-production.yaml
   ```

## Configuration

See `values.yaml` for all configurable options.

### Key Configuration Areas:

- **Image settings**: Registry, repository, tag, pull policy
- **Resources**: CPU and memory limits/requests
- **Scaling**: Replica counts and autoscaling settings
- **Networking**: Service types, ingress configuration
- **Security**: Security contexts, network policies
- **Storage**: Persistent volume claims for data persistence