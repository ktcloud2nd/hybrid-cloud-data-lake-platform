resource "aws_s3_bucket" "this" {
  bucket = "${var.name_prefix}-data"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-data"
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "delete-old-data"
    status = "Enabled"

    filter {
      prefix = "processed/"
    }

    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "images" {
  bucket = "${var.name_prefix}-images"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-images"
  })
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_versioning" "images" {
  bucket = aws_s3_bucket.images.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "images_public_read" {
  bucket = aws_s3_bucket.images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadForVehicleImages"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = "${aws_s3_bucket.images.arn}/*"
      }
    ]
  })
}

locals {
  vehicle_image_files = fileset("${path.module}/assets", "*")
}

resource "aws_s3_object" "vehicle_images" {
  for_each = { for file_name in local.vehicle_image_files : file_name => file_name }

  bucket = aws_s3_bucket.images.id
  key    = "models/${each.value}"
  source = "${path.module}/assets/${each.value}"
  etag   = filemd5("${path.module}/assets/${each.value}")

  content_type = lookup({
    png  = "image/png"
    jpg  = "image/jpeg"
    jpeg = "image/jpeg"
    webp = "image/webp"
  }, lower(element(split(".", each.value), length(split(".", each.value)) - 1)), "application/octet-stream")
}
resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = data.terraform_remote_state.network.outputs.private_db_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
  })
}

resource "aws_db_instance" "this" {
  identifier = "${var.name_prefix}-postgres"

  engine         = "postgres"
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_type      = var.storage_type
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = var.db_port

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [data.terraform_remote_state.network.outputs.db_sg_id]

  publicly_accessible = false
  multi_az            = false

  backup_retention_period = var.backup_retention_period

  auto_minor_version_upgrade = true
  deletion_protection        = false
  skip_final_snapshot        = true
  apply_immediately          = true

  performance_insights_enabled = false
  monitoring_interval          = 0

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
  })
}
