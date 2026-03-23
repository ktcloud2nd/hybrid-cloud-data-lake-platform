variable "region" {
  description = "Azure region"
  type        = string
  default     = "Korea Central"
}

variable "vm_size" {
  description = "VM Size"
  type        = string
  default     = "Standard_B2ts_v2"
}

variable "vm_image" {
  description = "VM Image"
  type        = map(string)
  default = {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
}

# Github Secrets를 통해 배포될 때 주입
variable "public_key" {
  description = "Public Key"
  type        = string
}

variable "admin_name" {
  description = "관리자 계정명"
  type        = string
  default     = "palja"
}