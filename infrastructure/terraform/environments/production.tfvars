# Production environment configuration
environment = "production"
aws_region  = "us-west-2"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

# EKS Configuration
kubernetes_version = "1.28"
node_instance_types = ["t3.medium"]
node_group_min_size = 2
node_group_max_size = 10
node_group_desired_size = 3

# Database Configuration
enable_rds = true  # Use RDS for production
db_instance_class = "db.t3.small"
db_allocated_storage = 50
db_max_allocated_storage = 200
db_backup_retention_period = 14