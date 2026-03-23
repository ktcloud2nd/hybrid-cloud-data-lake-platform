variable "aws_region" {
  description = "AWS region for compute resources."
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

variable "cluster_name" {
  description = "K3s cluster name used by Cluster Autoscaler."
  type        = string
  default     = "8team-cluster"
}

variable "k3s_shared_token" {
  description = "Shared token used by K3s servers and agents."
  type        = string
  sensitive   = true
}

variable "master_a_private_ip" {
  description = "Static private IP for the primary K3s server in subnet A."
  type        = string
}

variable "master_c_private_ip" {
  description = "Static private IP for the secondary K3s server in subnet C."
  type        = string
}
