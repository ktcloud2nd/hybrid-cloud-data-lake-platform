# Lambda를 이용한 S3 to RDS 파이프라인 구축 예정이었으나,
# 계획 변경으로 무산 (혹여나 Lambda를 사용하게 될 경우를 대비해 주석 처리)

/*
# 파이썬 코드 ZIP 압축 (자동화)
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/lambda_function.zip"
}

# 람다 실행용 IAM Role
resource "aws_iam_role" "lambda_exec_role" {
  name = "vehicle_lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 앞서 만들어진 Role에 람다에게 필요한 정책 연결
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole" # VPC 접속 + 로그 남기기
}

resource "aws_iam_role_policy_attachment" "s3_readonly" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess" # S3 읽기
}

# 람다 함수 정의
resource "aws_lambda_function" "s3_to_rds" {
  filename      = data.archive_file.lambda_zip.output_path
  function_name = "s3_to_rds_processor"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.9"
  timeout       = 60 # 람다가 한 번 실행될 때 버틸 수 있는 최대 시간(초)
  layers = ["arn:aws:lambda:ap-northeast-2:898466741470:layer:psycopg2-py39:2"]

  # RDS가 있는 VPC 내부로 배치
  vpc_config {
    subnet_ids         = data.terraform_remote_state.network.outputs.private_db_subnet_ids
    security_group_ids = [data.terraform_remote_state.network.outputs.security_group_ids["lambda"]]
  }

  environment {
    variables = {
      DB_HOST = aws_db_instance.postgresql.address
      DB_NAME = var.db_name
      DB_USER = var.db_username
      DB_PASS = var.db_password
    }
  }
}

# S3 버킷 알림 설정 (트리거)
resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.data.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.s3_to_rds.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw/" # S3의 raw/ 폴더에 쌓일 때만 작동
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

# S3가 람다를 깨울 수 있게 허용
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_to_rds.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.data.arn
}
*/