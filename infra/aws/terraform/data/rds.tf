resource "aws_db_subnet_group" "postgresql" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = data.terraform_remote_state.network.outputs.private_db_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
  })
}

resource "aws_db_instance" "postgresql" {
  identifier = "${var.name_prefix}-postgres"

  engine         = "postgres"
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_type      = var.storage_type
  storage_encrypted = true # 데이터 암호화

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = var.db_port

  db_subnet_group_name   = aws_db_subnet_group.postgresql.name
  vpc_security_group_ids = [data.terraform_remote_state.network.outputs.db_sg_id]

  publicly_accessible = false
  multi_az            = false # Multi-AZ 적용(true) 예정

  backup_retention_period = var.backup_retention_period

  auto_minor_version_upgrade = true
  deletion_protection        = false
  skip_final_snapshot        = true # 데모 시 false로 바꿔야 함
  apply_immediately          = true

  performance_insights_enabled = false
  monitoring_interval          = 0

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
  })
}