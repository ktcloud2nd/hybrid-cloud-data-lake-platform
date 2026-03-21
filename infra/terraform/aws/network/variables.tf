variable "aws_region" {
  description = "AWS region for the public cloud environment."
  type        = string
  default     = "ap-northeast-2"
}

variable "name_prefix" {
  description = "Prefix used for AWS resource names."
  type        = string
  default     = "ktcloud2nd"
}

variable "availability_zones" {
  description = "Availability zones used by the VPC."
  type        = list(string)
  default     = ["ap-northeast-2a", "ap-northeast-2c"]

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "This baseline assumes exactly two availability zones."
  }
}

variable "vpc_cidr" {
  description = "Primary CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) > 0                 # 수정됨
    error_message = "At least one public subnet CIDR must be provided." # 수정됨
  }
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for private application subnets."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]

  validation {
    condition     = length(var.private_app_subnet_cidrs) > 0                 # 수정됨
    error_message = "At least one private app subnet CIDR must be provided." # 수정됨
  }
}

variable "private_db_subnet_cidrs" {
  description = "CIDR blocks for private database subnets."
  type        = list(string)
  default     = ["10.0.20.0/24", "10.0.21.0/24"]

  validation {
    condition     = length(var.private_db_subnet_cidrs) > 0                 # 수정됨
    error_message = "At least one private DB subnet CIDR must be provided." # 수정됨
  }
}

variable "enable_multi_nat" {
  description = "Create one NAT gateway per AZ. False means a single NAT in the first public subnet."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags applied to all resources."
  type        = map(string)
  default = {
    Environment = "dev"
    Owner       = "infra1"
  }
}