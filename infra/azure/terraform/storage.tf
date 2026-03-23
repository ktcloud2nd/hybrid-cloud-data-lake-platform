resource "random_string" "storage_suffix" {
  length  = 6
  special = false
  upper   = false
}

# 원본 데이터 저장 스토리지 계정 생성
resource "azurerm_storage_account" "raw_storage" {
  name                     = "vehicleraw${random_string.storage_suffix.result}"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  
  # 비용 최적화: LRS (Locally Redundant Storage)
  account_replication_type = "LRS"

  tags = {
    environment = "dev"
    purpose     = "raw-data-lake"
  }
}

# 스토리지 계정 안에 데이터를 담을 컨테이너(버킷) 생성
resource "azurerm_storage_container" "raw_container" {
  name                  = "raw-topic-container"
  storage_account_id    = azurerm_storage_account.raw_storage.id
  
  # 외부 인터넷에서 URL 쳐서 들어오는 거 원천 차단 (Private)
  container_access_type = "private" 
}