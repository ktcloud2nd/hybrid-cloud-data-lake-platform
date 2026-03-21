terraform {
  backend "azurerm" {
    resource_group_name  = "palja-tfstate-rg"
    storage_account_name = "paljatfstate1234"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

# Resource Group 생성
resource "azurerm_resource_group" "rg" {
  name     = "palja-rg"
  location = var.region
}