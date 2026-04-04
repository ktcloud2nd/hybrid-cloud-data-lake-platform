locals {
  public_subnet_roles                = ["edge-ops", "edge-public"]
  private_app_roles                  = ["shared-app-a", "shared-app-c"]
  private_db_roles                   = ["db-a", "db-c"]
  public_hosted_zone_name_normalized = trimsuffix(var.public_hosted_zone_name, ".")
  user_app_host                      = "app.${local.public_hosted_zone_name_normalized}"
  operator_app_host                  = "admin.${local.public_hosted_zone_name_normalized}"

  private_app_nat_gateway_index = {
    for idx, subnet in var.private_app_subnet_cidrs :
    idx => (var.enable_multi_nat ? idx : 0)
  }
}

data "aws_route53_zone" "public" {
  count        = var.create_public_dns_records ? 1 : 0
  name         = "${local.public_hosted_zone_name_normalized}."
  private_zone = false
}

# ALB에 붙일 HTTPS 인증서 자체를 AWS에서 발급
# app.palja.click / admin.palja.click 용 ACM 인증서 생성 (Route 53 DNS 검증까지 연결)
resource "aws_acm_certificate" "public_apps" {
  count                     = var.create_public_dns_records ? 1 : 0
  domain_name               = local.user_app_host
  subject_alternative_names = [local.operator_app_host]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.name_prefix}-public-apps-cert"
  }
}

# ACM이 요구하는 DNS 검증용 CNAME 레코드를 Route 53에 자동 생성
resource "aws_route53_record" "public_apps_cert_validation" {
  for_each = var.create_public_dns_records ? {
    for dvo in aws_acm_certificate.public_apps[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id         = data.aws_route53_zone.public[0].zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

# DNS 검증이 끝나면 인증서를 ISSUED 상태로 확정
resource "aws_acm_certificate_validation" "public_apps" {
  count = var.create_public_dns_records ? 1 : 0

  certificate_arn         = aws_acm_certificate.public_apps[0].arn
  validation_record_fqdns = [for record in aws_route53_record.public_apps_cert_validation : record.fqdn]
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.name_prefix}-igw"
  }
}

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.name_prefix}-public-${count.index + 1}"
    Tier = "public"
    Role = local.public_subnet_roles[count.index]
  }
}

resource "aws_subnet" "private_app" {
  count = length(var.private_app_subnet_cidrs)

  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_app_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.name_prefix}-private-app-${count.index + 1}"
    Tier = "private-app"
    Role = local.private_app_roles[count.index]
  }
}

# DB 서브넷
resource "aws_subnet" "db" {
  count = length(var.db_subnet_cidrs)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.db_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true # RDS가 공인 IP를 가짐

  tags = {
    Name = "${var.name_prefix}-db-${count.index + 1}"
    Tier = "db"
    Role = local.private_db_roles[count.index]
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = {
    Name = "${var.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  count = var.enable_multi_nat ? length(var.public_subnet_cidrs) : 1

  domain = "vpc"

  tags = {
    Name = "${var.name_prefix}-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "this" {
  count = var.enable_multi_nat ? length(var.public_subnet_cidrs) : 1

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  depends_on = [aws_internet_gateway.this]

  tags = {
    Name = "${var.name_prefix}-nat-${count.index + 1}"
  }
}

resource "aws_route_table" "private_app" {
  count = length(var.private_app_subnet_cidrs)

  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[local.private_app_nat_gateway_index[count.index]].id
  }

  tags = {
    Name = "${var.name_prefix}-private-app-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "private_app" {
  count = length(aws_subnet.private_app)

  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

resource "aws_route_table" "db" {
  count  = length(var.db_subnet_cidrs)
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id # NAT가 아닌 IGW 연결
  }

  tags = {
    Name = "${var.name_prefix}-db-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "db" {
  count = length(aws_subnet.db)

  subnet_id      = aws_subnet.db[count.index].id
  route_table_id = aws_route_table.db[count.index].id
}

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "Security group for the public ALB."
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "Allow HTTP from the internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS from the internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-alb-sg"
  }
}

resource "aws_security_group" "k3s_nodes" {
  name        = "${var.name_prefix}-k3s-nodes-sg"
  description = "Security group for K3s control plane and worker nodes."
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "Allow node-to-node traffic inside the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description     = "Allow HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Allow HTTPS from ALB"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-k3s-nodes-sg"
  }
}

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db-sg"
  description = "Security group for PostgreSQL database resources."
  vpc_id      = aws_vpc.this.id

  # K3s 노드, Azure Consumer VM 허용 예정
  ingress {
    description     = "Allow PostgreSQL from K3s nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.k3s_nodes.id]
    # QuickSight -> RDS 연결
    cidr_blocks = ["13.124.145.32/27"] # IP Whitelist 방식 (추후 VPC Connection 방식으로 변경 예정)
    # cidr_blocks은 Azure에서 추가 (Azure NAT IP 넣어야 함)
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-db-sg"
  }
}

resource "aws_lb" "public" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  idle_timeout       = 60

  tags = {
    Name = "${var.name_prefix}-alb"
  }
}

# ALB Target Group - 워커 노드 HTTP:80 (Traefik)
# ★ ALB가 실제 HTTPS를 받아주고, HTTP는 HTTPS로 강제 전환 ★
# ALB는 443으로 받고, 뒤쪽 K3s/Traefik에는 HTTP 80으로 넘겨도 됨
resource "aws_lb_target_group" "worker_http" {
  name     = "${var.name_prefix}-worker-http-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.this.id

  health_check {
    path                = "/ping"
    protocol            = "HTTP"
    port                = "80"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name = "${var.name_prefix}-worker-http-tg"
  }
}

# ALB Listener - HTTP:80 -> 워커 노드:80 포워딩
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

    # default_action 내용을 redirect로 변경
    default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.public.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.public_apps[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.worker_http.arn
  }
}

resource "aws_route53_record" "user_app_alias" {
  count           = var.create_public_dns_records ? 1 : 0
  zone_id         = data.aws_route53_zone.public[0].zone_id
  name            = local.user_app_host
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.public.dns_name
    zone_id                = aws_lb.public.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "operator_app_alias" {
  count           = var.create_public_dns_records ? 1 : 0
  zone_id         = data.aws_route53_zone.public[0].zone_id
  name            = local.operator_app_host
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.public.dns_name
    zone_id                = aws_lb.public.zone_id
    evaluate_target_health = true
  }
}
