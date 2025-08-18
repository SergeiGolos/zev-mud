# Production Deployment Plan - zev-mud

**DevOps Strategy & Step-by-Step Production Deployment Guide**

---

## Executive Summary

This document provides a comprehensive DevOps deployment strategy for the zev-mud browser-based MUD system. It outlines the complete journey from development to production, including CI/CD automation, infrastructure as code, monitoring, security, and cloud deployment strategies.

**Target Architecture:** 3-tier containerized application with automated deployment, monitoring, and disaster recovery capabilities.

---

## Table of Contents

1. [Deployment Strategy Overview](#1-deployment-strategy-overview)
2. [Pre-Production Checklist](#2-pre-production-checklist)
3. [Infrastructure Setup](#3-infrastructure-setup)
4. [CI/CD Pipeline Implementation](#4-cicd-pipeline-implementation)
5. [Production Environment Configuration](#5-production-environment-configuration)
6. [Monitoring & Observability](#6-monitoring--observability)
7. [Security & Compliance](#7-security--compliance)
8. [Performance & Scaling](#8-performance--scaling)
9. [Disaster Recovery & Backup](#9-disaster-recovery--backup)
10. [Go-Live Procedure](#10-go-live-procedure)
11. [Post-Deployment Operations](#11-post-deployment-operations)
12. [Rollback Procedures](#12-rollback-procedures)

---

## 1. Deployment Strategy Overview

### 1.1 Deployment Approach
- **Blue-Green Deployment**: Zero-downtime releases with instant rollback capability
- **Containerization**: Docker-based microservices with Kubernetes orchestration
- **Infrastructure as Code**: Terraform for cloud resources, Helm charts for Kubernetes
- **Automated CI/CD**: GitHub Actions for build, test, and deployment automation

### 1.2 Target Environments

| Environment | Purpose | Infrastructure | Access |
|-------------|---------|---------------|--------|
| **Development** | Feature development | Local Docker/Minikube | Developer machines |
| **Staging** | Pre-production testing | Cloud instance (small) | Internal team |
| **Production** | Live system | Cloud cluster (scalable) | Public users |

### 1.3 Technology Stack
- **Orchestration**: Kubernetes (EKS/GKE/AKS)
- **Service Mesh**: Istio (optional for advanced networking)
- **Monitoring**: Prometheus + Grafana + AlertManager
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Security**: Vault for secrets, TLS everywhere
- **Load Balancing**: Cloud load balancer + Ingress controller

---

## 2. Pre-Production Checklist

### 2.1 Code Readiness ✅
- [x] All services containerized with proper Dockerfiles
- [x] Health check endpoints implemented (`/health`)
- [x] Environment variable configuration externalized
- [x] Logging structured and configured
- [ ] Security scanning completed (dependency vulnerabilities)
- [ ] Performance testing executed
- [ ] Load testing completed

### 2.2 Infrastructure Requirements
- [ ] Cloud provider account setup (AWS/GCP/Azure)
- [ ] Domain name registered and DNS configured
- [ ] SSL certificates obtained (Let's Encrypt or commercial)
- [ ] Monitoring tools selected and configured
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented

### 2.3 Team Readiness
- [ ] DevOps access permissions configured
- [ ] Production environment access controls established
- [ ] Incident response procedures documented
- [ ] Team training on deployment procedures completed
- [ ] Communication channels set up (alerts, notifications)

---

## 3. Infrastructure Setup

### 3.1 Cloud Infrastructure (Terraform)

**3.1.1 AWS Infrastructure Setup**

Create infrastructure with Terraform:

```hcl
# infrastructure/terraform/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  
  cluster_name    = "zev-mud-cluster"
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  eks_managed_node_groups = {
    main = {
      desired_size = 2
      max_size     = 10
      min_size     = 2
      
      instance_types = ["t3.medium"]
      
      k8s_labels = {
        Environment = var.environment
        Application = "zev-mud"
      }
    }
  }
}

# RDS for persistent data (optional upgrade from NeDB)
resource "aws_db_instance" "mud_db" {
  count = var.use_rds ? 1 : 0
  
  identifier = "zev-mud-${var.environment}"
  engine     = "postgres"
  engine_version = "15.4"
  
  allocated_storage = 20
  storage_type      = "gp2"
  storage_encrypted = true
  
  db_name  = "zevmud"
  username = "mudadmin"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds[0].id]
  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  
  skip_final_snapshot = var.environment == "staging"
  
  tags = {
    Name = "zev-mud-${var.environment}"
  }
}
```

**3.1.2 Deployment Steps**

```bash
# Step 1: Initialize Terraform
cd infrastructure/terraform
terraform init

# Step 2: Plan infrastructure
terraform plan -var-file="environments/${ENVIRONMENT}.tfvars"

# Step 3: Apply infrastructure
terraform apply -var-file="environments/${ENVIRONMENT}.tfvars"

# Step 4: Configure kubectl
aws eks update-kubeconfig --name zev-mud-cluster --region us-west-2
```

### 3.2 Kubernetes Configuration

**3.2.1 Namespace Setup**

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: zev-mud
  labels:
    name: zev-mud
    environment: production
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: zev-mud-quota
  namespace: zev-mud
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    persistentvolumeclaims: "3"
```

**3.2.2 ConfigMap for Environment Variables**

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: zev-mud-config
  namespace: zev-mud
data:
  NODE_ENV: "production"
  RANVIER_PORT: "3000"
  WS_PORT: "8080"
  WEB_CLIENT_PORT: "3001"
  TELNET_HOST: "ranvier-service"
  TELNET_PORT: "3000"
  CONNECTION_TIMEOUT: "30000"
  MAX_CONNECTIONS: "100"
```

---

## 4. CI/CD Pipeline Implementation

### 4.1 GitHub Actions Workflow

**4.1.1 Main CI/CD Pipeline**

```yaml
# .github/workflows/deploy.yml
name: Deploy zev-mud

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [ranvier, proxy, web-client]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: ${{ matrix.service }}/package-lock.json
      
      - name: Install dependencies
        run: |
          cd ${{ matrix.service }}
          npm ci
      
      - name: Run tests
        run: |
          cd ${{ matrix.service }}
          npm test
        timeout-minutes: 10

  build:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [ranvier, proxy, web-client]
    steps:
      - uses: actions/checkout@v4
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2
      
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name zev-mud-cluster-staging
      
      - name: Deploy to staging
        run: |
          helm upgrade --install zev-mud ./helm/zev-mud \
            --namespace zev-mud-staging \
            --create-namespace \
            --values ./helm/zev-mud/values-staging.yaml \
            --set image.tag=${{ github.sha }} \
            --wait --timeout=600s
      
      - name: Run health checks
        run: |
          kubectl wait --for=condition=ready pod -l app=zev-mud -n zev-mud-staging --timeout=300s
          ./scripts/health-check.sh staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2
      
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name zev-mud-cluster-production
      
      - name: Deploy to production (Blue-Green)
        run: |
          # Deploy to green environment
          helm upgrade --install zev-mud-green ./helm/zev-mud \
            --namespace zev-mud-production \
            --values ./helm/zev-mud/values-production.yaml \
            --set image.tag=${{ github.sha }} \
            --set deployment.color=green \
            --wait --timeout=600s
          
          # Health check green deployment
          ./scripts/health-check.sh production green
          
          # Switch traffic to green
          kubectl patch service zev-mud-service -n zev-mud-production \
            --patch '{"spec":{"selector":{"color":"green"}}}'
          
          # Cleanup old blue deployment
          helm uninstall zev-mud-blue -n zev-mud-production || true
          
          # Rename green to blue for next deployment
          helm upgrade --install zev-mud-blue ./helm/zev-mud \
            --namespace zev-mud-production \
            --values ./helm/zev-mud/values-production.yaml \
            --set image.tag=${{ github.sha }} \
            --set deployment.color=blue \
            --wait --timeout=600s
```

### 4.2 Helm Charts

**4.2.1 Helm Chart Structure**

```bash
# Create Helm chart structure
helm create zev-mud
cd zev-mud

# Directory structure:
helm/
└── zev-mud/
    ├── Chart.yaml
    ├── values.yaml
    ├── values-staging.yaml
    ├── values-production.yaml
    └── templates/
        ├── deployment.yaml
        ├── service.yaml
        ├── ingress.yaml
        ├── configmap.yaml
        ├── secrets.yaml
        └── hpa.yaml
```

**4.2.2 Deployment Template**

```yaml
# helm/zev-mud/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "zev-mud.fullname" . }}-{{ .Values.service.name }}
  labels:
    {{- include "zev-mud.labels" . | nindent 4 }}
    service: {{ .Values.service.name }}
    color: {{ .Values.deployment.color | default "blue" }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "zev-mud.selectorLabels" . | nindent 6 }}
      service: {{ .Values.service.name }}
      color: {{ .Values.deployment.color | default "blue" }}
  template:
    metadata:
      labels:
        {{- include "zev-mud.selectorLabels" . | nindent 8 }}
        service: {{ .Values.service.name }}
        color: {{ .Values.deployment.color | default "blue" }}
    spec:
      serviceAccountName: {{ include "zev-mud.serviceAccountName" . }}
      containers:
        - name: {{ .Values.service.name }}
          image: "{{ .Values.image.repository }}-{{ .Values.service.name }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: {{ .Values.service.healthPath | default "/health" }}
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: {{ .Values.service.healthPath | default "/health" }}
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            {{- range $key, $value := .Values.env }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          volumeMounts:
            {{- if eq .Values.service.name "ranvier" }}
            - name: data
              mountPath: /app/data
            {{- end }}
      volumes:
        {{- if eq .Values.service.name "ranvier" }}
        - name: data
          persistentVolumeClaim:
            claimName: {{ include "zev-mud.fullname" . }}-data
        {{- end }}
```

---

## 5. Production Environment Configuration

### 5.1 Environment Variables

**5.1.1 Production Environment File**

```bash
# environments/production.env
NODE_ENV=production

# Ranvier Configuration
RANVIER_PORT=3000
RANVIER_LOG_LEVEL=info
DATA_PATH=/app/data
DB_PATH=/app/data/characters.db

# Proxy Configuration
WS_PORT=8080
WS_HOST=0.0.0.0
TELNET_HOST=ranvier-service
TELNET_PORT=3000
CONNECTION_TIMEOUT=30000
MAX_CONNECTIONS=200
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Web Client Configuration
WEB_CLIENT_PORT=3001
STATIC_PATH=/app/public
PROXY_URL=ws://proxy-service:8080

# Security Configuration
SESSION_SECRET=your-secure-session-secret
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGIN=https://your-domain.com

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30

# Database Configuration (if using PostgreSQL)
DB_TYPE=postgres
DB_HOST=rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=zevmud
DB_USER=mudadmin
DB_PASSWORD=secure-password
DB_SSL=true
DB_POOL_MIN=2
DB_POOL_MAX=10
```

### 5.2 Kubernetes Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: zev-mud-secrets
  namespace: zev-mud
type: Opaque
data:
  session-secret: <base64-encoded-session-secret>
  jwt-secret: <base64-encoded-jwt-secret>
  db-password: <base64-encoded-db-password>
```

### 5.3 Persistent Volumes

```yaml
# k8s/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ranvier-data-pvc
  namespace: zev-mud
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: gp2
```

---

## 6. Monitoring & Observability

### 6.1 Prometheus Configuration

**6.1.1 Prometheus Deployment**

```yaml
# monitoring/prometheus/values.yaml
prometheus:
  prometheusSpec:
    retention: 15d
    resources:
      requests:
        cpu: 200m
        memory: 1Gi
      limits:
        cpu: 500m
        memory: 2Gi
    
    additionalScrapeConfigs:
      - job_name: 'zev-mud-services'
        kubernetes_sd_configs:
          - role: endpoints
            namespaces:
              names:
                - zev-mud
        relabel_configs:
          - source_labels: [__meta_kubernetes_service_name]
            action: keep
            regex: .*-metrics
```

### 6.2 Grafana Dashboards

**6.2.1 Application Dashboard**

```json
{
  "dashboard": {
    "title": "zev-mud Application Metrics",
    "panels": [
      {
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "websocket_active_connections{job=\"proxy-metrics\"}",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{service}} - {{method}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

### 6.3 Alerting Rules

**6.3.1 Critical Alerts**

```yaml
# monitoring/alerts/zev-mud-alerts.yaml
groups:
  - name: zev-mud.rules
    rules:
      - alert: ServiceDown
        expr: up{job=~".*zev-mud.*"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "Service {{ $labels.job }} has been down for more than 1 minute"
      
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests per second"
      
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 90% for container {{ $labels.container }}"
      
      - alert: DatabaseConnectionsHigh
        expr: db_connections_active / db_connections_max > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connections running high"
          description: "Database connections are at {{ $value }}% of maximum"
```

---

## 7. Security & Compliance

### 7.1 Security Scanning

**7.1.1 Container Security Scanning**

```yaml
# .github/workflows/security.yml
name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1' # Weekly scan

jobs:
  container-scan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [ranvier, proxy, web-client]
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t ${{ matrix.service }}:scan ./${{ matrix.service }}
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ matrix.service }}:scan
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run npm audit
        run: |
          for service in ranvier proxy web-client; do
            cd $service
            npm audit --audit-level high
            cd ..
          done
```

### 7.2 Network Security

**7.2.1 Network Policies**

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: zev-mud-network-policy
  namespace: zev-mud
spec:
  podSelector:
    matchLabels:
      app: zev-mud
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3001
    - from:
        - podSelector:
            matchLabels:
              service: proxy
      ports:
        - protocol: TCP
          port: 8080
    - from:
        - podSelector:
            matchLabels:
              service: web-client
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to: []
      ports:
        - protocol: TCP
          port: 53
        - protocol: UDP
          port: 53
    - to:
        - podSelector:
            matchLabels:
              app: zev-mud
```

### 7.3 Pod Security Standards

```yaml
# k8s/pod-security-policy.yaml
apiVersion: v1
kind: Pod
metadata:
  name: zev-mud-ranvier
  namespace: zev-mud
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: ranvier
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        runAsNonRoot: true
        runAsUser: 1001
        capabilities:
          drop:
            - ALL
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: data
          mountPath: /app/data
  volumes:
    - name: tmp
      emptyDir: {}
    - name: data
      persistentVolumeClaim:
        claimName: ranvier-data-pvc
```

---

## 8. Performance & Scaling

### 8.1 Horizontal Pod Autoscaling

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: zev-mud-hpa
  namespace: zev-mud
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: zev-mud-proxy
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
```

### 8.2 Resource Limits

```yaml
# Resource allocation per service
resources:
  ranvier:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi
  proxy:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 300m
      memory: 256Mi
  web-client:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 128Mi
```

### 8.3 Performance Testing

```javascript
// performance/load-test.js
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(options) {
    this.url = options.url || 'ws://localhost:8080';
    this.connections = options.connections || 50;
    this.duration = options.duration || 60000; // 1 minute
    this.messageInterval = options.messageInterval || 1000; // 1 second
  }

  async runTest() {
    console.log(`Starting load test with ${this.connections} connections for ${this.duration/1000}s`);
    
    const connections = [];
    const metrics = {
      connectionsEstablished: 0,
      connectionsFailed: 0,
      messagessent: 0,
      messagesReceived: 0,
      errors: 0,
      responseTimeSum: 0,
      responseTimeCount: 0
    };

    // Create connections
    for (let i = 0; i < this.connections; i++) {
      try {
        const ws = new WebSocket(this.url);
        
        ws.on('open', () => {
          metrics.connectionsEstablished++;
          console.log(`Connection ${i + 1} established`);
          
          // Send periodic messages
          const messageTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const startTime = performance.now();
              ws.send('look');
              metrics.messagesSource++;
            }
          }, this.messageInterval);
          
          // Cleanup after test duration
          setTimeout(() => {
            clearInterval(messageTimer);
            ws.close();
          }, this.duration);
        });
        
        ws.on('message', (data) => {
          metrics.messagesReceived++;
          const responseTime = performance.now() - startTime;
          metrics.responseTimeSum += responseTime;
          metrics.responseTimeCount++;
        });
        
        ws.on('error', (error) => {
          metrics.errors++;
          console.error(`Connection ${i + 1} error:`, error.message);
        });
        
        ws.on('close', () => {
          console.log(`Connection ${i + 1} closed`);
        });
        
        connections.push(ws);
      } catch (error) {
        metrics.connectionsFailed++;
        console.error(`Failed to create connection ${i + 1}:`, error.message);
      }
    }

    // Wait for test completion
    await new Promise(resolve => setTimeout(resolve, this.duration + 1000));

    // Calculate results
    const averageResponseTime = metrics.responseTimeSum / metrics.responseTimeCount;
    
    console.log('\n=== Load Test Results ===');
    console.log(`Connections Established: ${metrics.connectionsEstablished}`);
    console.log(`Connections Failed: ${metrics.connectionsFailed}`);
    console.log(`Messages Sent: ${metrics.messagesSource}`);
    console.log(`Messages Received: ${metrics.messagesReceived}`);
    console.log(`Errors: ${metrics.errors}`);
    console.log(`Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
    console.log(`Success Rate: ${((metrics.messagesReceived / metrics.messagesSource) * 100).toFixed(2)}%`);
  }
}

// Run load test
if (require.main === module) {
  const tester = new LoadTester({
    url: process.env.WEBSOCKET_URL || 'ws://localhost:8080',
    connections: parseInt(process.env.CONNECTIONS) || 50,
    duration: parseInt(process.env.DURATION) || 60000,
    messageInterval: parseInt(process.env.MESSAGE_INTERVAL) || 1000
  });
  
  tester.runTest().catch(console.error);
}
```

---

## 9. Disaster Recovery & Backup

### 9.1 Backup Strategy

**9.1.1 Automated Database Backup**

```bash
#!/bin/bash
# scripts/backup-database.sh

set -euo pipefail

# Configuration
NAMESPACE="zev-mud"
BACKUP_BUCKET="s3://zev-mud-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="zev-mud-backup-${DATE}"
RETENTION_DAYS=30

echo "Starting database backup: ${BACKUP_NAME}"

# Create backup
kubectl exec -n ${NAMESPACE} deployment/ranvier -- tar -czf /tmp/${BACKUP_NAME}.tar.gz /app/data

# Copy backup from pod
kubectl cp ${NAMESPACE}/ranvier:/tmp/${BACKUP_NAME}.tar.gz /tmp/${BACKUP_NAME}.tar.gz

# Upload to S3
aws s3 cp /tmp/${BACKUP_NAME}.tar.gz ${BACKUP_BUCKET}/database/

# Verify backup
if aws s3 ls ${BACKUP_BUCKET}/database/${BACKUP_NAME}.tar.gz; then
    echo "Backup successful: ${BACKUP_NAME}.tar.gz"
    
    # Cleanup local files
    rm -f /tmp/${BACKUP_NAME}.tar.gz
    kubectl exec -n ${NAMESPACE} deployment/ranvier -- rm -f /tmp/${BACKUP_NAME}.tar.gz
    
    # Cleanup old backups
    aws s3 ls ${BACKUP_BUCKET}/database/ --recursive | \
        awk '{print $4}' | \
        grep 'zev-mud-backup-' | \
        sort | \
        head -n -${RETENTION_DAYS} | \
        xargs -I {} aws s3 rm ${BACKUP_BUCKET}/database/{}
else
    echo "Backup failed!" >&2
    exit 1
fi

echo "Backup completed successfully"
```

**9.1.2 Configuration Backup**

```bash
#!/bin/bash
# scripts/backup-config.sh

set -euo pipefail

NAMESPACE="zev-mud"
BACKUP_BUCKET="s3://zev-mud-backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONFIG_BACKUP="config-backup-${DATE}"

echo "Backing up Kubernetes configurations"

# Create temporary directory
mkdir -p /tmp/${CONFIG_BACKUP}

# Backup Kubernetes resources
kubectl get all,pvc,secrets,configmaps -n ${NAMESPACE} -o yaml > /tmp/${CONFIG_BACKUP}/k8s-resources.yaml

# Backup Helm values
helm get values zev-mud -n ${NAMESPACE} > /tmp/${CONFIG_BACKUP}/helm-values.yaml

# Backup Infrastructure as Code
cp -r infrastructure/ /tmp/${CONFIG_BACKUP}/

# Create archive
tar -czf /tmp/${CONFIG_BACKUP}.tar.gz -C /tmp ${CONFIG_BACKUP}

# Upload to S3
aws s3 cp /tmp/${CONFIG_BACKUP}.tar.gz ${BACKUP_BUCKET}/config/

# Cleanup
rm -rf /tmp/${CONFIG_BACKUP} /tmp/${CONFIG_BACKUP}.tar.gz

echo "Configuration backup completed: ${CONFIG_BACKUP}.tar.gz"
```

### 9.2 Disaster Recovery Procedures

**9.2.1 Service Recovery Runbook**

```markdown
# Disaster Recovery Runbook

## Complete System Failure Recovery

### Step 1: Assess Damage
1. Check cloud provider status dashboard
2. Verify infrastructure components (EKS cluster, RDS, Load Balancer)
3. Check monitoring systems for root cause

### Step 2: Infrastructure Recovery
```bash
# Recreate infrastructure if needed
cd infrastructure/terraform
terraform plan -var-file="environments/production.tfvars"
terraform apply -var-file="environments/production.tfvars"

# Update kubeconfig
aws eks update-kubeconfig --name zev-mud-cluster-production
```

### Step 3: Application Recovery
```bash
# Restore from backup
./scripts/restore-from-backup.sh latest

# Deploy application
helm upgrade --install zev-mud ./helm/zev-mud \
  --namespace zev-mud \
  --values ./helm/zev-mud/values-production.yaml \
  --wait --timeout=600s
```

### Step 4: Data Recovery
```bash
# Restore database from latest backup
LATEST_BACKUP=$(aws s3 ls s3://zev-mud-backups/database/ | sort | tail -n 1 | awk '{print $4}')
./scripts/restore-database.sh ${LATEST_BACKUP}
```

### Step 5: Verification
```bash
# Run comprehensive health checks
./scripts/health-check.sh production

# Verify functionality
./scripts/smoke-test.sh production
```

## Recovery Time Objectives (RTO)
- **Critical System Failure**: 30 minutes
- **Database Corruption**: 15 minutes  
- **Single Service Failure**: 5 minutes
- **Data Corruption**: 60 minutes (from backup)

## Recovery Point Objectives (RPO)
- **Database**: 1 hour (automated backups)
- **Configuration**: 24 hours
- **Application State**: Real-time (stateless services)
```

---

## 10. Go-Live Procedure

### 10.1 Pre-Go-Live Checklist

**10.1.1 Final Verification Steps**

- [ ] **Infrastructure Readiness**
  - [ ] All cloud resources provisioned and healthy
  - [ ] DNS records configured and propagated
  - [ ] SSL certificates installed and valid
  - [ ] Load balancers configured with health checks
  - [ ] Monitoring systems operational

- [ ] **Application Readiness**
  - [ ] All services deployed and running
  - [ ] Health checks passing
  - [ ] Database migrations completed
  - [ ] Configuration validated
  - [ ] Performance tests passed

- [ ] **Security Readiness**
  - [ ] Security scanning completed (no critical vulnerabilities)
  - [ ] Network policies applied
  - [ ] Secrets management configured
  - [ ] Access controls verified
  - [ ] Backup systems operational

- [ ] **Team Readiness**
  - [ ] Runbooks documented and accessible
  - [ ] Team trained on production procedures
  - [ ] Communication channels established
  - [ ] Incident response procedures tested
  - [ ] On-call rotation scheduled

### 10.2 Go-Live Execution

**10.2.1 Deployment Sequence**

```bash
#!/bin/bash
# scripts/go-live.sh

set -euo pipefail

echo "=== zev-mud Production Go-Live Procedure ==="
echo "Starting deployment at $(date)"

# Step 1: Final infrastructure validation
echo "1. Validating infrastructure..."
terraform plan -var-file="environments/production.tfvars" -detailed-exitcode
if [ $? -ne 0 ]; then
    echo "Infrastructure drift detected! Aborting."
    exit 1
fi

# Step 2: Pre-deployment health check
echo "2. Checking staging environment health..."
./scripts/health-check.sh staging
if [ $? -ne 0 ]; then
    echo "Staging environment unhealthy! Aborting."
    exit 1
fi

# Step 3: Database backup
echo "3. Creating pre-deployment backup..."
./scripts/backup-database.sh

# Step 4: Deploy to production
echo "4. Deploying to production..."
helm upgrade --install zev-mud ./helm/zev-mud \
    --namespace zev-mud \
    --values ./helm/zev-mud/values-production.yaml \
    --wait --timeout=600s

# Step 5: Health verification
echo "5. Verifying deployment health..."
sleep 30  # Allow services to fully start
./scripts/health-check.sh production

# Step 6: Smoke tests
echo "6. Running smoke tests..."
./scripts/smoke-test.sh production

# Step 7: Performance validation
echo "7. Running performance validation..."
./scripts/performance-check.sh production

echo "=== Go-Live Completed Successfully at $(date) ==="
echo "Application is live at: https://your-domain.com"
```

### 10.3 Post-Go-Live Monitoring

**10.3.1 Immediate Monitoring (First 24 Hours)**

```bash
#!/bin/bash
# scripts/post-golive-monitoring.sh

echo "Starting intensive post-go-live monitoring..."

# Monitor for 24 hours with 5-minute intervals
END_TIME=$(($(date +%s) + 86400))  # 24 hours from now

while [ $(date +%s) -lt $END_TIME ]; do
    echo "=== Monitoring Check at $(date) ==="
    
    # Service health
    kubectl get pods -n zev-mud
    kubectl top pods -n zev-mud
    
    # Health endpoints
    curl -sf http://localhost:3001/health || echo "Web client health check failed"
    curl -sf http://localhost:8080/health || echo "Proxy health check failed"
    
    # Resource utilization
    echo "Resource Usage:"
    kubectl top nodes
    
    # Active connections
    echo "Active Connections:"
    curl -s http://localhost:8080/health | jq '.activeConnections'
    
    # Error rates
    echo "Recent Errors (last 5 minutes):"
    kubectl logs --since=5m -l app=zev-mud | grep -i error | wc -l
    
    echo "---"
    sleep 300  # 5 minutes
done

echo "24-hour monitoring period completed"
```

---

## 11. Post-Deployment Operations

### 11.1 Daily Operations

**11.1.1 Daily Health Checks**

```bash
#!/bin/bash
# scripts/daily-health-check.sh

echo "=== Daily Health Check - $(date) ==="

# Service status
echo "1. Service Status:"
kubectl get pods -n zev-mud -o wide

# Resource usage
echo "2. Resource Usage:"
kubectl top pods -n zev-mud --sort-by=memory
kubectl top nodes

# Health endpoints
echo "3. Health Endpoints:"
for endpoint in "http://localhost:3001/health" "http://localhost:8080/health"; do
    if curl -sf $endpoint > /dev/null; then
        echo "✓ $endpoint - Healthy"
    else
        echo "✗ $endpoint - Failed"
    fi
done

# Database size
echo "4. Database Size:"
kubectl exec -n zev-mud deployment/ranvier -- du -sh /app/data

# Active connections
echo "5. Active Connections:"
curl -s http://localhost:8080/health | jq '.activeConnections, .uptime'

# Recent errors
echo "6. Recent Errors (last 24 hours):"
kubectl logs --since=24h -l app=zev-mud | grep -i error | wc -l

# Backup status
echo "7. Backup Status:"
aws s3 ls s3://zev-mud-backups/database/ | tail -3

echo "=== Health Check Complete ==="
```

### 11.2 Weekly Operations

**11.2.1 Weekly Maintenance Tasks**

```bash
#!/bin/bash
# scripts/weekly-maintenance.sh

echo "=== Weekly Maintenance - $(date) ==="

# Security updates
echo "1. Checking for security updates..."
kubectl get vulnerabilities -A || echo "No vulnerability scanning configured"

# Performance analysis
echo "2. Performance Analysis:"
kubectl top pods -n zev-mud --sort-by=cpu
kubectl describe hpa -n zev-mud

# Log rotation
echo "3. Log Rotation:"
kubectl logs --since=7d -l app=zev-mud | wc -l
echo "lines of logs in the past 7 days"

# Database optimization
echo "4. Database Maintenance:"
kubectl exec -n zev-mud deployment/ranvier -- du -sh /app/data/*

# Certificate expiry check
echo "5. Certificate Expiry:"
kubectl get certificates -n zev-mud

# Backup verification
echo "6. Backup Verification:"
LATEST_BACKUP=$(aws s3 ls s3://zev-mud-backups/database/ | sort | tail -n 1 | awk '{print $4}')
echo "Latest backup: $LATEST_BACKUP"

echo "=== Weekly Maintenance Complete ==="
```

### 11.3 Monthly Operations

**11.3.1 Monthly Review and Optimization**

```bash
#!/bin/bash
# scripts/monthly-review.sh

echo "=== Monthly Review - $(date) ==="

# Cost analysis
echo "1. Cost Analysis:"
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-02-01 \
    --granularity MONTHLY --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE || echo "Cost data unavailable"

# Performance trends
echo "2. Performance Trends:"
echo "This would typically pull from monitoring systems like Prometheus"

# Capacity planning
echo "3. Capacity Planning:"
kubectl describe nodes | grep -A 5 "Allocated resources"

# Security review
echo "4. Security Review:"
echo "Review access logs, update dependencies, rotate secrets if needed"

# Disaster recovery test
echo "5. DR Test Recommendation:"
echo "Consider scheduling a disaster recovery test"

echo "=== Monthly Review Complete ==="
```

---

## 12. Rollback Procedures

### 12.1 Automated Rollback

**12.1.1 Helm Rollback**

```bash
#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

NAMESPACE=${1:-zev-mud}
REVISION=${2:-} # Optional revision number

echo "=== Rollback Procedure ==="
echo "Namespace: $NAMESPACE"

if [ -z "$REVISION" ]; then
    echo "Rolling back to previous revision..."
    helm rollback zev-mud -n $NAMESPACE
else
    echo "Rolling back to revision: $REVISION"
    helm rollback zev-mud $REVISION -n $NAMESPACE
fi

# Wait for rollback to complete
echo "Waiting for rollback to complete..."
kubectl rollout status deployment/ranvier -n $NAMESPACE
kubectl rollout status deployment/proxy -n $NAMESPACE
kubectl rollout status deployment/web-client -n $NAMESPACE

# Verify rollback
echo "Verifying rollback..."
./scripts/health-check.sh production

if [ $? -eq 0 ]; then
    echo "✓ Rollback successful"
else
    echo "✗ Rollback verification failed"
    exit 1
fi

echo "=== Rollback Complete ==="
```

### 12.2 Emergency Procedures

**12.2.1 Circuit Breaker Activation**

```bash
#!/bin/bash
# scripts/emergency-stop.sh

echo "=== EMERGENCY STOP PROCEDURE ==="
echo "This will stop all user traffic to the application"

# Scale down to zero replicas
kubectl scale deployment --replicas=0 -l app=zev-mud -n zev-mud

# Update ingress to show maintenance page
kubectl patch ingress zev-mud-ingress -n zev-mud \
    --patch '{"spec":{"rules":[{"host":"your-domain.com","http":{"paths":[{"path":"/","backend":{"serviceName":"maintenance-service","servicePort":80}}]}}]}}'

echo "All services stopped. Maintenance page active."
echo "To restore: ./scripts/restore-service.sh"
```

**12.2.2 Database Rollback**

```bash
#!/bin/bash
# scripts/rollback-database.sh

set -euo pipefail

BACKUP_NAME=${1:-latest}

echo "=== Database Rollback Procedure ==="
echo "Backup: $BACKUP_NAME"

# Stop application services
kubectl scale deployment --replicas=0 -l app=zev-mud -n zev-mud

# Restore database
if [ "$BACKUP_NAME" = "latest" ]; then
    BACKUP_FILE=$(aws s3 ls s3://zev-mud-backups/database/ | sort | tail -n 1 | awk '{print $4}')
else
    BACKUP_FILE="$BACKUP_NAME"
fi

echo "Restoring from: $BACKUP_FILE"
aws s3 cp s3://zev-mud-backups/database/$BACKUP_FILE /tmp/$BACKUP_FILE

# Apply backup
kubectl cp /tmp/$BACKUP_FILE zev-mud/ranvier:/tmp/restore.tar.gz
kubectl exec -n zev-mud deployment/ranvier -- bash -c "cd / && tar -xzf /tmp/restore.tar.gz"

# Restart services
kubectl scale deployment --replicas=2 -l app=zev-mud -n zev-mud

# Verify
./scripts/health-check.sh production

echo "=== Database Rollback Complete ==="
```

---

## Conclusion

This production deployment plan provides a comprehensive roadmap for deploying the zev-mud system to production with enterprise-grade practices. The plan emphasizes automation, monitoring, security, and operational excellence.

### Key Success Factors

1. **Automation First**: Every process is automated to reduce human error
2. **Monitoring Everything**: Comprehensive observability across all layers
3. **Security by Design**: Security integrated throughout the deployment pipeline
4. **Disaster Recovery**: Prepared for various failure scenarios
5. **Scalability**: Built to handle growth from day one

### Next Steps

1. **Implement CI/CD Pipeline**: Start with GitHub Actions workflows
2. **Set Up Infrastructure**: Deploy cloud resources using Terraform
3. **Configure Monitoring**: Install Prometheus and Grafana
4. **Test Procedures**: Validate all scripts and runbooks
5. **Team Training**: Ensure team is prepared for production operations
6. **Go-Live Planning**: Schedule and execute production deployment

### Support and Maintenance

- **Documentation**: Keep all procedures updated
- **Team Training**: Regular training on deployment procedures
- **Process Improvement**: Continuously improve based on lessons learned
- **Tool Updates**: Keep all tools and dependencies current

This plan serves as the foundation for a reliable, scalable, and maintainable production deployment of the zev-mud system.