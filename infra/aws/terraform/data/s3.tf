# ---------- ktcloud2nd-dev-data ----------

resource "aws_s3_bucket" "data" {
  bucket        = "${var.name_prefix}-data"
  force_destroy = true # 버킷 강제 삭제 (destroy용), 실무에서는 절대 안씀

  tags   = merge(var.tags, {
    Name = "${var.name_prefix}-data"
  })
}

# S3 버킷의 수명 주기 설정을 담당하는 별도 리소스
resource "aws_s3_bucket_lifecycle_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    id     = "delete-old-data"
    status = "Enabled"

    filter {}

    expiration {
      days = 7 # 7일 뒤 자동 삭제
    }
  }
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id
  
  # 버킷 공개 차단 (중요 데이터)
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id

  versioning_configuration {
    status = "Enabled" # 버전 관리 활성화
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # 모든 데이터 암호화
    }
  }
}

# ---------- ktcloud2nd-dev-images ----------

resource "aws_s3_bucket" "images" {
  bucket        = "${var.name_prefix}-images"
  force_destroy = true

  tags   = merge(var.tags, {
    Name = "${var.name_prefix}-images"
  })
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  # 버킷 공개
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

# 버킷 정책 (외부 접근 허용)
resource "aws_s3_bucket_policy" "images_public_read" {
  bucket = aws_s3_bucket.images.id

  # 퍼블릭 액세스 차단 해제 후 정책 실행
  depends_on = [aws_s3_bucket_public_access_block.images]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadForVehicleImages"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"] # 파일 읽기(다운로드)만 허용
        Resource  = "${aws_s3_bucket.images.arn}/*"
      }
    ]
  })
}

# 차량 이미지 접근
locals {
  vehicle_image_files = fileset("${path.module}/assets", "*")
}

# 차량 이미지 버킷에 자동 업로드
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