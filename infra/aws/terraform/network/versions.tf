terraform {
  required_version = ">= 1.6.0"

  # 기존코드+수정됨: 로컬 backend 미사용 상태에서 S3 remote backend 사용으로 변경
  backend "s3" {
    bucket  = "8team-terraform-tfstate"
    key     = "network/terraform.tfstate"
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
