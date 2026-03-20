# Consumer NIC
resource "azurerm_network_interface" "consumer_nic" {
  name                = "consumer-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.consumer_subnet.id
    private_ip_address_allocation = "Static"
    private_ip_address            = "10.0.2.4" # 애저 예약 IP(.0~.3)를 피해서 .4부터 사용
  }
}

# Consumer VM 인스턴스
resource "azurerm_linux_virtual_machine" "consumer_vm" {
  name                = "consumer-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  size                = "Standard_B1s" # 테스트용 1

  admin_username = "palja"

  network_interface_ids = [
    azurerm_network_interface.consumer_nic.id
  ]

  zone = "1"

  admin_ssh_key {
    username   = "palja"
    public_key = file("~/.ssh/id_rsa.pub")
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS" # SSD로 변경
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }
}
