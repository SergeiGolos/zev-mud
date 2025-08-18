#!/bin/bash
# Backup script for zev-mud database

set -euo pipefail

NAMESPACE=${1:-zev-mud}
BACKUP_DIR="/backup/zev-mud"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="zev-mud-backup-${DATE}"

echo "=== Database Backup Procedure ==="
echo "Namespace: $NAMESPACE"
echo "Backup name: $BACKUP_NAME"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

# Create backup from Ranvier pod
echo "Creating backup from Ranvier container..."
kubectl exec -n $NAMESPACE deployment/ranvier -- tar -czf /tmp/${BACKUP_NAME}.tar.gz /app/data

# Copy backup from pod to local storage
echo "Copying backup to local storage..."
kubectl cp $NAMESPACE/$(kubectl get pod -n $NAMESPACE -l app=ranvier -o jsonpath='{.items[0].metadata.name}'):/tmp/${BACKUP_NAME}.tar.gz $BACKUP_DIR/${BACKUP_NAME}.tar.gz

# Verify backup file
if [ -f "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)
    echo "✓ Backup created successfully: ${BACKUP_NAME}.tar.gz ($BACKUP_SIZE)"
    
    # Clean up temporary file from pod
    kubectl exec -n $NAMESPACE deployment/ranvier -- rm -f /tmp/${BACKUP_NAME}.tar.gz
    
    # Optional: Upload to cloud storage (uncomment and configure as needed)
    # aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "s3://zev-mud-backups/database/"
    
    echo "=== Backup Complete ==="
else
    echo "✗ Backup failed!"
    exit 1
fi