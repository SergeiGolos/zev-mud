# Staging environment configuration
environment = "staging"
aws_region  = "us-west-2"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b"]
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
public_subnet_cidrs = ["10.0.101.0/24", "10.0.102.0/24"]

# EKS Configuration
kubernetes_version = "1.28"
node_instance_types = ["t3.small"]
node_group_min_size = 1
node_group_max_size = 3
node_group_desired_size = 1

# Database Configuration
enable_rds = false  # Use NeDB for staging
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_backup_retention_period = 3