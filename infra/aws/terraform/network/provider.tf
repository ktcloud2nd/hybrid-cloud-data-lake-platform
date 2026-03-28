terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket  = "palja-terraform-backend"
    key     = "aws/network/terraform.tfstate"
    region  = "ap-northeast-2"
    encrypt = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(
      {
        Project   = "ktcloud2nd"
        ManagedBy = "Terraform"
        Component = "network"
      },
      var.tags
    )
  }
}
