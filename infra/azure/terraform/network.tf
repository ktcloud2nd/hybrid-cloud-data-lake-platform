# VNet 생성
resource "azurerm_virtual_network" "vnet" {
  name                = "palja-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

# Kafka Broker Subnet 생성
resource "azurerm_subnet" "broker_subnet" {
  name                 = "broker-subnet"
  address_prefixes     = ["10.0.1.0/24"]
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
}

# Kafka Consumer Subnet 생성
resource "azurerm_subnet" "consumer_subnet" {
  name                 = "consumer-subnet"
  address_prefixes     = ["10.0.2.0/24"]
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name

  # Azure Storage는 Azure 백본망 경유로만 접근하도록 service endpoint 사용
  service_endpoints = ["Microsoft.Storage"]
}

# Bastion Subnet 생성
resource "azurerm_subnet" "bastion_subnet" {
  name                 = "bastion-subnet"
  address_prefixes     = ["10.0.3.0/24"]
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
}

# Consumer 전용 NAT Gateway와 공인 IP
resource "azurerm_public_ip" "consumer_nat_ip" {
  name                = "consumer-nat-ip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_nat_gateway" "consumer_nat_gw" {
  name                = "consumer-nat-gw"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku_name            = "Standard"
}

resource "azurerm_nat_gateway_public_ip_association" "nat_ip_assoc" {
  nat_gateway_id       = azurerm_nat_gateway.consumer_nat_gw.id
  public_ip_address_id = azurerm_public_ip.consumer_nat_ip.id
}

resource "azurerm_subnet_nat_gateway_association" "consumer_subnet_nat" {
  subnet_id      = azurerm_subnet.consumer_subnet.id
  nat_gateway_id = azurerm_nat_gateway.consumer_nat_gw.id
}

# Broker는 온프렘 Kafka 트래픽과 VNet 내부 SSH만 허용
resource "azurerm_network_security_group" "broker_private_nsg" {
  name                = "broker-private-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow-kafka-brokers"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "${var.onprem_ip}/32"
    destination_port_ranges    = ["9094", "9095", "9096"]
    source_port_range          = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-ssh-from-vnet"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "10.0.0.0/16"
    destination_port_range     = "22"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }
}

# Consumer는 VNet 내부 SSH만 허용
resource "azurerm_network_security_group" "consumer_private_nsg" {
  name                = "consumer-private-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow-ssh-from-vnet"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "10.0.0.0/16"
    destination_port_range     = "22"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }

  # Kafka Connect REST API는 외부 공개하지 않는다.
  # 필요 시 내부 관리 용도로만 아래 블록을 다시 활성화한다.
  # security_rule {
  #   name                       = "allow-kafka-connect-api"
  #   priority                   = 120
  #   direction                  = "Inbound"
  #   access                     = "Allow"
  #   protocol                   = "Tcp"
  #   source_address_prefix      = "10.0.0.0/16"
  #   destination_port_range     = "8083"
  #   source_port_range          = "*"
  #   destination_address_prefix = "*"
  # }
}

# Bastion은 외부 SSH 진입점 역할
resource "azurerm_network_security_group" "bastion_nsg" {
  name                = "bastion-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow-ssh-from-external"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*"
    destination_port_range     = "22"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }
}

# Subnet에 실제 사용할 NSG 연결
resource "azurerm_subnet_network_security_group_association" "broker_assoc" {
  subnet_id                 = azurerm_subnet.broker_subnet.id
  network_security_group_id = azurerm_network_security_group.broker_private_nsg.id
}

resource "azurerm_subnet_network_security_group_association" "consumer_assoc" {
  subnet_id                 = azurerm_subnet.consumer_subnet.id
  network_security_group_id = azurerm_network_security_group.consumer_private_nsg.id
}

resource "azurerm_subnet_network_security_group_association" "bastion_assoc" {
  subnet_id                 = azurerm_subnet.bastion_subnet.id
  network_security_group_id = azurerm_network_security_group.bastion_nsg.id
}
