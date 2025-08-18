# zev-mud Deployment Scripts

This directory contains operational scripts for managing the zev-mud deployment.

## Scripts Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `health-check.sh` | Verify service health | `./health-check.sh [environment]` |
| `smoke-test.sh` | Basic functionality test | `./smoke-test.sh [environment]` |
| `backup-database.sh` | Backup game data | `./backup-database.sh [namespace]` |
| `restore-database.sh` | Restore from backup | `./restore-database.sh [backup-file]` |
| `deploy.sh` | Deploy to environment | `./deploy.sh [environment]` |
| `rollback.sh` | Rollback deployment | `./rollback.sh [revision]` |

## Environment Parameters

- `production` - Production environment
- `staging` - Staging environment  
- `development` or `local` - Local development

## Prerequisites

- `kubectl` configured for target cluster
- `helm` installed for Kubernetes deployments
- `curl` for HTTP health checks
- `nc` (netcat) for TCP port checks
- `jq` for JSON parsing (optional)

## Usage Examples

```bash
# Check health of staging environment
./scripts/health-check.sh staging

# Run smoke tests on production
./scripts/smoke-test.sh production

# Create database backup
./scripts/backup-database.sh zev-mud

# Deploy to staging
./scripts/deploy.sh staging

# Rollback last deployment
./scripts/rollback.sh
```

## Exit Codes

All scripts follow standard exit code conventions:
- `0` - Success
- `1` - General error
- `2` - Invalid parameters

## Logging

Scripts log to stdout/stderr and can be redirected for operational logging:

```bash
./scripts/health-check.sh production 2>&1 | tee -a /var/log/zev-mud-operations.log
```