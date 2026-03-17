# AWS Network Baseline

인프라 1 담당 범위를 위한 Terraform 시작점입니다.

## Included Resources

- VPC
- Public / Private App / Private DB Subnets
- Internet Gateway
- NAT Gateway
- Route Tables and Associations
- S3 Gateway VPC Endpoint
- Core Security Groups
- Internet-facing ALB baseline

## Files

- `versions.tf`: Terraform 및 AWS provider 버전
- `variables.tf`: 네트워크 입력값
- `main.tf`: 네트워크 리소스 정의
- `outputs.tf`: 다른 스택에서 참조할 출력값
- `terraform.tfvars.example`: 팀 합의 전 기준값 예시

## Suggested Next Steps

1. `docs/network-matrix.md` 기준으로 CIDR/AZ를 팀과 확정
2. 실제 관리자 공인 IP로 `allowed_ssh_cidrs` 교체
3. ALB Listener/Target Group은 인프라 2와 연결 시점에 추가
4. WAF 연결은 ALB 구성이 고정된 뒤 진행
