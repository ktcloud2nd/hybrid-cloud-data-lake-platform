resource "aws_db_subnet_group" "postgresql" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private_db[*].id

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
  vpc_security_group_ids = [aws_security_group.db.id]

  publicly_accessible = false
  multi_az            = false # Multi-AZ 적용(true) 예정

  backup_retention_period = var.backup_retention_period

  auto_minor_version_upgrade = true
  deletion_protection        = false
  skip_final_snapshot        = true # 데모 시 false로 바꿔야 함
  apply_immediately          = true

  performance_insights_enabled = false
  monitoring_interval          = 0

  lifecycle {
    prevent_destroy = false # 일단 false로 바꿈 (destroy 가능하게)
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
  })
}

# Route 53 프라이빗 호스팅 영역 (삭제 방지 설정)
resource "aws_route53_zone" "private" {
  name = "vehicle.internal" # 우리가 지정한 도메인 이름

  vpc {
    vpc_id = aws_vpc.this.id
  }

  lifecycle {
    prevent_destroy = true # 700원 아끼기 위해 테라폼 destroy 시에도 남겨둠
  }

  tags = var.tags
}

# RDS 고정 주소 레코드 (CNAME)
resource "aws_route53_record" "db_endpoint" {
  zone_id = aws_route53_zone.private.zone_id
  name    = "db.vehicle.internal" # 앤서블에서 사용할 고정 주소
  type    = "CNAME"
  ttl     = "300"
  records = [aws_db_instance.postgresql.address]
}