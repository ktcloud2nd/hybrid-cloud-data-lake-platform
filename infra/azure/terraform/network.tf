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

  # Azure 스토리지와 통신할 때 내부망(Azure Backbone)만 타도록 설정
  service_endpoints    = ["Microsoft.Storage"]
}

# NAT Gateway
# Consumer Public IP 생성 (NAT Gateway에 붙음)
resource "azurerm_public_ip" "consumer_nat_ip" {
  name                = "consumer-nat-ip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

# NAT Gateway 생성
resource "azurerm_nat_gateway" "consumer_nat_gw" {
  name                = "consumer-nat-gw"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku_name            = "Standard"
}

# NAT Gateway에 Public IP 연결
resource "azurerm_nat_gateway_public_ip_association" "nat_ip_assoc" {
  nat_gateway_id       = azurerm_nat_gateway.consumer_nat_gw.id
  public_ip_address_id = azurerm_public_ip.consumer_nat_ip.id
}

# Consuemr Subnet에 NAT Gateway 연결
resource "azurerm_subnet_nat_gateway_association" "consumer_subnet_nat" {
  subnet_id      = azurerm_subnet.consumer_subnet.id
  nat_gateway_id = azurerm_nat_gateway.consumer_nat_gw.id
}

# Broker NSG 생성
resource "azurerm_network_security_group" "broker_nsg" {
  name                = "broker-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow-kafka-brokers"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*"
    destination_port_ranges    = ["9094", "9095", "9096"]
    source_port_range          = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-ssh"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*" # 임시 개방
    destination_port_range     = "22"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }
}

# Consumer NSG 생성
resource "azurerm_network_security_group" "consumer_nsg" {
  name                = "consumer-nsg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "allow-ssh"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*" # 10.0.1.0/24여야 하나, GitHub Actions 접속을 위해 임시로 전체 개방 (보안을 위해 Bastion(Broker) 방식 사용해도 되나 복잡해짐)
    destination_port_range     = "22"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }

	# Kafka Connect API용
  security_rule {
    name                       = "allow-kafka-connect-api"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*" 
    destination_port_range     = "8083"
    source_port_range          = "*"
    destination_address_prefix = "*"
  }
}

# NSG 연결
resource "azurerm_subnet_network_security_group_association" "broker_assoc" {
  subnet_id                 = azurerm_subnet.broker_subnet.id
  network_security_group_id = azurerm_network_security_group.broker_nsg.id
}

resource "azurerm_subnet_network_security_group_association" "consumer_assoc" {
  subnet_id                 = azurerm_subnet.consumer_subnet.id
  network_security_group_id = azurerm_network_security_group.consumer_nsg.id
}