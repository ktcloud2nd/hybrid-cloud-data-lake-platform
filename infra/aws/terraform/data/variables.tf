variable "name_prefix" {
  description = "Prefix used for AWS resource names."
  type        = string
  default     = "ktcloud2nd-dev"
}

variable "aws_region" {
  description = "AWS region for data layer resources."
  type        = string
  default     = "ap-northeast-2"
}

// 기존코드+수정됨
// variable "network_state_path" {
//   description = "Local path to the network terraform state file."
//   type        = string
//   default     = "../network/terraform.tfstate"
// }

variable "network_state_bucket" {
  description = "S3 bucket that stores the network terraform state file."
  type        = string
  default     = "8team-terraform-tfstate"
}

variable "network_state_key" {
  description = "S3 object key for the network terraform state file."
  type        = string
  default     = "network/terraform.tfstate"
}

variable "network_state_region" {
  description = "AWS region of the S3 bucket that stores the network terraform state file."
  type        = string
  default     = "ap-northeast-2"
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "vehicle_db"
}

variable "db_username" {
  description = "Master username for RDS."
  type        = string
  default     = "dbadmin"
}

variable "db_password" {
  description = "Master password for RDS."
  type        = string
  sensitive   = true
}

variable "db_port" {
  description = "PostgreSQL port."
  type        = number
  default     = 5432
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Allocated storage in GB."
  type        = number
  default     = 20
}

variable "storage_type" {
  description = "Storage type for RDS."
  type        = string
  default     = "gp3"
}

variable "backup_retention_period" {
  description = "Backup retention period in days."
  type        = number
  default     = 1
}

variable "tags" {
  description = "Additional tags applied to all resources."
  type        = map(string)
  default = {
    Environment = "dev"
    Owner       = "infra3"
  }
}
