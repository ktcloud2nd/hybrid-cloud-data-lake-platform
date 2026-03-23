output "broker_public_ip" {
  description = "Broker VM에 접속하기 위한 공인 IP 주소"
  value       = azurerm_public_ip.broker_public_ip.ip_address
}

output "consumer_public_ip" {
  description = "Consumer VM에 직접 접속하기 위한 공인 IP 주소"
  value       = azurerm_public_ip.consumer_public_ip.ip_address
}

output "consumer_nat_public_ip" {
  description = "NAT 공인 IP 주소"
  value       = azurerm_public_ip.consumer_nat_ip.ip_address
}

output "admin_username" {
  description = "Broker VM에 접속하기 위한 관리자 계정명"
  value       = azurerm_linux_virtual_machine.broker_vm.admin_username # VM 리소스에서 직접 가져옴
}

# Ansible(Kafka Connect)이 접속할 때 쓸 비밀번호 출력
output "azure_storage_account_name" {
  description = "생성된 애저 스토리지 계정 이름"
  value       = azurerm_storage_account.raw_storage.name
}

output "azure_storage_primary_key" {
  description = "스토리지 계정에 접근하기 위한 마스터 키"
  value       = azurerm_storage_account.raw_storage.primary_access_key
  sensitive   = true
}