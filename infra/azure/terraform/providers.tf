# AWS S3에 Azure tfstate 저장 (tfstate 금고를 AWS로 통일)
terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket         = "palja-terraform-backend"
    key            = "azure/terraform.tfstate"
    region         = "ap-northeast-2"
    encrypt = true
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    # AWS 프로바이더 정의
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# AWS 프로바이더 설정
provider "aws" {
  region = "ap-northeast-2"
}

# 이미 배포된 AWS 네트워크 정보 읽기
data "terraform_remote_state" "aws" {
  backend = "s3"
  config = {
    bucket = "palja-terraform-backend"
    key    = "aws/network/terraform.tfstate" # AWS 네트워크 경로
    region = "ap-northeast-2"
  }
}

# Resource Group 생성
resource "azurerm_resource_group" "rg" {
  name     = "palja-rg"
  location = var.region
}