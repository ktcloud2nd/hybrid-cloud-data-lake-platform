check "public_subnet_count_matches_azs" {
  assert {
    condition     = length(var.public_subnet_cidrs) == length(var.availability_zones)
    error_message = "Public subnet count must match the number of availability zones."
  }
}

check "private_app_subnet_count_matches_azs" {
  assert {
    condition     = length(var.private_app_subnet_cidrs) == length(var.availability_zones)
    error_message = "Private app subnet count must match the number of availability zones."
  }
}

check "private_db_subnet_count_matches_azs" {
  assert {
    condition     = length(var.private_db_subnet_cidrs) == length(var.availability_zones)
    error_message = "Private DB subnet count must match the number of availability zones."
  }
}