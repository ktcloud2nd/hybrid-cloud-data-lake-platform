data "aws_vpc" "selected" {
  filter {
    name   = "tag:Name"
    values = ["${var.name_prefix}-vpc"]
  }
}

data "aws_subnets" "db" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.selected.id]
  }
  filter {
    name   = "tag:Tier"
    values = ["db"]
  }
}

data "aws_security_group" "db_sg" {
  filter {
    name   = "tag:Name"
    values = ["${var.name_prefix}-db-sg"] # network/의 aws_security_group.db 태그와 일치
  }
}

resource "aws_db_subnet_group" "postgresql" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = data.aws_subnets.db.ids # 여기서 찾아온 ID 사용

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
  })
}

# PostgreSQL 생성
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
  vpc_security_group_ids = [data.aws_security_group.db_sg.id]

  publicly_accessible = true # Consumer VM으로부터 데이터 받으려면 퍼블릭 액세스 허용해야 함 (방화벽 있으므로 보안 안심해도 됨)
  multi_az            = true  # Multi-AZ enabled

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

# Route 53 프라이빗 호스팅 영역
resource "aws_route53_zone" "private" {
  name = "vehicle.internal" # 우리가 지정한 도메인 이름
  vpc {
    vpc_id = data.aws_vpc.selected.id
  }

  tags = var.tags
}

# SSM에 DB 비밀번호 저장
resource "aws_ssm_parameter" "db_password" {
  name        = "/config/vehicle/db_password"
  description = "DB 비밀번호"
  type        = "SecureString" # 암호화 저장
  value       = var.db_password # 테라폼 변수에 들어있는 그 비번
}
# 비밀번호 전달 파이프라인:
# GitHub Secrets에 PW 보관 -> temp 치환 -> SSM 생성

# RDS 고정 주소 레코드 (CNAME)
resource "aws_route53_record" "db_endpoint" {
  zone_id = aws_route53_zone.private.zone_id
  name    = "db.vehicle.internal" # 앤서블에서 사용할 고정 주소
  type    = "CNAME"
  ttl     = "300"
  records = [aws_db_instance.postgresql.address]
}
