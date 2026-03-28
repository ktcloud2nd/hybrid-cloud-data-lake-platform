# Azure의 NAT IP가 생성되면 AWS DB 보안그룹에 룰을 추가하는 코드

resource "aws_security_group_rule" "allow_azure_nat_to_aws_db" {
  # AWS 프로바이더 사용 명시
  provider          = aws 
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  description       = "Allow PostgreSQL from Azure Consumer NAT Gateway"

  # 기존 DB 보안그룹에 아래 내용 추가
  cidr_blocks       = ["${azurerm_public_ip.consumer_nat_ip.ip_address}/32"]

  # AWS remote_state에서 가져온 DB 보안그룹 ID
  security_group_id = data.terraform_remote_state.aws.outputs.db_sg_id
}

# ----------------------------------------
# Q. 왜 보안 그룹 안에서 정의하지 않고 룰을 따로 뺐나요?
# A. 보안 그룹 리소스 내부에 인라인으로 규칙을 정의할 경우,
# 클라우드 간의 순환 의존성(Circular Dependency)이 발생하여 초기 배포가 불가능해집니다.
# 이를 해결하기 위해 보안 그룹 본체는 AWS 인프라 배포 시 생성하고,
# 실제 접근 권한인 Security Group Rule은 접속 주체인 Azure 프로젝트에서 독립적으로 관리하도록 설계하여 프로비저닝 순서를 최적화했습니다.
# ----------------------------------------