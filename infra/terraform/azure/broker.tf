# Public IP 생성
resource "azurerm_public_ip" "broker_public_ip" {
  name                = "broker-public-ip"
  location            = var.region                            # 변수 적용
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"                          # 고정 IP 설정
  sku                 = "Standard"
  zones               = ["1"]
}

# Broker NIC 생성
resource "azurerm_network_interface" "broker_nic" {
  name                = "broker-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.broker_subnet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.broker_public_ip.id
  }
}

# Broker VM 인스턴스 생성
resource "azurerm_linux_virtual_machine" "broker_vm" {
  name                = "broker-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.region
  size                = var.vm_size
  zone                = "1"
  admin_username      = var.admin_name

  network_interface_ids = [
    azurerm_network_interface.broker_nic.id
  ]

  admin_ssh_key {
    username   = var.admin_name
    public_key = var.public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
  }

  source_image_reference {
    publisher = var.vm_image.publisher
    offer     = var.vm_image.offer
    sku       = var.vm_image.sku
    version   = var.vm_image.version
  }
}
