output "broker_public_ip" {
  description = "Broker VM에 접속하기 위한 공인 IP 주소"
  value       = azurerm_public_ip.broker_public_ip.ip_address
}

output "consumer_nat_public_ip" {
  description = "NAT 공인 IP 주소"
  value       = azurerm_public_ip.consumer_nat_ip.ip_address
}