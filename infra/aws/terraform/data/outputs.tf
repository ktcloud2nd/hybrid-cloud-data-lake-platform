output "db_instance_identifier" {
  description = "RDS instance identifier."
  value       = aws_db_instance.postgresql.identifier
}

output "db_endpoint" {
  description = "RDS endpoint address."
  value       = aws_db_instance.postgresql.address
}

output "db_port" {
  description = "RDS port."
  value       = aws_db_instance.postgresql.port
}

output "db_name" {
  description = "Initial database name."
  value       = aws_db_instance.postgresql.db_name
}

output "db_username" {
  description = "Master username for RDS."
  value       = aws_db_instance.postgresql.username
}

output "db_subnet_group_name" {
  description = "DB subnet group name."
  value       = aws_db_subnet_group.postgresql.name
}