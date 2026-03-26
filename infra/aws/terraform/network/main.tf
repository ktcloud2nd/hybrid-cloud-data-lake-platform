locals {
  public_subnet_roles = ["edge-ops", "edge-public"]
  private_app_roles   = ["shared-app-a", "shared-app-c"]
  private_db_roles    = ["db-a", "db-c"]

  private_app_nat_gateway_index = {
    for idx, subnet in var.private_app_subnet_cidrs :
    idx => (var.enable_multi_nat ? idx : 0)
  }
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
resource "aws_subnet" "private_db" {
  count = length(var.private_db_subnet_cidrs)

  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_db_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.name_prefix}-private-db-${count.index + 1}"
    Tier = "private-db"
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

resource "aws_route_table" "private_db" {
  count = length(var.private_db_subnet_cidrs)

  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.name_prefix}-private-db-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "private_db" {
  count = length(aws_subnet.private_db)

  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private_db[count.index].id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(aws_route_table.private_app[*].id, aws_route_table.private_db[*].id)

  tags = {
    Name = "${var.name_prefix}-s3-endpoint"
  }
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

  # K3s 노드 허용
  ingress {
    description     = "Allow PostgreSQL from K3s nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.k3s_nodes.id]
  }

  # 람다 함수 허용
  #ingress {
  #  description     = "Allow PostgreSQL from Lambda"
  #  from_port       = 5432
  #  to_port         = 5432
  #  protocol        = "tcp"
  #  security_groups = [aws_security_group.lambda.id]
  #}

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
  }

  tags = {
    Name = "${var.name_prefix}-worker-http-tg"
  }
}

# ALB Listener - HTTP:80 → 워커 노드:80 포워딩
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.worker_http.arn
  }
}
# 람다 전용 보안 그룹
#resource "aws_security_group" "lambda" {
#  name        = "${var.name_prefix}-lambda-sg"
#  description = "Security group for the data processor lambda"
#  vpc_id      = aws_vpc.this.id

#  egress {
#    from_port   = 0
#    to_port     = 0
#    protocol    = "-1"
#    cidr_blocks = ["0.0.0.0/0"]
#  }

#  tags = {
#    Name = "${var.name_prefix}-lambda-sg"
#  }
#}
