variable "name_prefix" {
  description = "Prefix used for AWS resource names."
  type        = string
  default     = "ktcloud2nd-dev"
}

variable "db_subnet_ids" {
  description = "Private DB subnet IDs from the network module."
  type        = list(string)
}

variable "vpc_security_group_ids" {
  description = "Security group IDs for the RDS instance."
  type        = list(string)
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