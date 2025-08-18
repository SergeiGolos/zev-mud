# Infrastructure as Code - Terraform Configuration

This directory contains Terraform configurations for deploying zev-mud infrastructure to various cloud providers.

## Directory Structure

```
infrastructure/
├── terraform/
│   ├── main.tf              # Main infrastructure configuration
│   ├── variables.tf         # Variable definitions
│   ├── outputs.tf           # Output values
│   ├── providers.tf         # Provider configurations
│   └── environments/
│       ├── staging.tfvars   # Staging environment variables
│       └── production.tfvars # Production environment variables
├── kubernetes/
│   ├── namespaces/          # Kubernetes namespace definitions
│   ├── monitoring/          # Monitoring stack configurations
│   └── ingress/             # Ingress controller configurations
└── scripts/
    ├── deploy-infrastructure.sh
    └── destroy-infrastructure.sh
```

## Usage

1. **Initialize Terraform**:
   ```bash
   cd infrastructure/terraform
   terraform init
   ```

2. **Plan Infrastructure**:
   ```bash
   terraform plan -var-file="environments/staging.tfvars"
   ```

3. **Deploy Infrastructure**:
   ```bash
   terraform apply -var-file="environments/production.tfvars"
   ```

## Cloud Provider Support

- **AWS**: EKS, RDS, VPC, Security Groups
- **Google Cloud**: GKE, Cloud SQL, VPC
- **Azure**: AKS, Azure Database, Virtual Network

## Security Considerations

- All resources are created with least privilege access
- Network security groups restrict traffic appropriately
- Secrets are managed through cloud provider secret managers
- Encryption is enabled for all data at rest and in transit