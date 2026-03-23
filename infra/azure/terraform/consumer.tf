# Consumer Public IP 생성
resource "azurerm_public_ip" "consumer_public_ip" {
  name                = "consumer-public-ip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard" # NAT Gateway와 호환되려면 Standard여야 함
}

# Consumer NIC 생성
resource "azurerm_network_interface" "consumer_nic" {
  name                = "consumer-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.consumer_subnet.id
    private_ip_address_allocation = "Static"
    private_ip_address            = "10.0.2.4"
    public_ip_address_id          = azurerm_public_ip.consumer_public_ip.id
  }
}

# Consumer VM 인스턴스 생성
resource "azurerm_linux_virtual_machine" "consumer_vm" {
  name                = "consumer-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.region
  size                = var.vm_size
  zone                = "1"
  admin_username      = var.admin_name

  network_interface_ids = [
    azurerm_network_interface.consumer_nic.id
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
