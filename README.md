# ktcloud2nd

멀티클라우드 기반 차량 데이터 플랫폼 2차 프로젝트 저장소입니다.

현재 저장소는 AWS 퍼블릭 클라우드 베이스라인과 팀 협업용 문서/폴더 구조를 먼저 세팅한 상태입니다. 인프라 1 담당자는 `infra/aws/terraform/network`를 기준으로 네트워크 작업을 이어가면 됩니다.

## Repository Layout

```text
repo-root/
├─ README.md
├─ AGENTS.md
├─ .github/
│  └─ workflows/
├─ apps/
│  └─ web-platform/
│     ├─ backend/
│     │  └─ src/
│     ├─ frontend/
│     │  ├─ public/
│     │  └─ src/
│     ├─ .env.example
│     ├─ deploy.env.example
│     └─ docker-compose.deployment.yml
├─ infra/
│  ├─ aws/
│  │  ├─ ansible/
│  │  ├─ lambda/
│  │  └─ terraform/
│  │     ├─ alerts/
│  │     ├─ compute/
│  │     ├─ data/
│  │     └─ network/
│  ├─ azure/
│  │  ├─ ansible/
│  │  ├─ scripts/
│  │  └─ terraform/
│  └─ edge/
│     ├─ Dockerfile
│     ├─ docker-compose.yml
│     └─ vehicle_simulator.py
└─ k8s/
   ├─ backend-login/
   ├─ backend-operator/
   ├─ backend-user/
   ├─ frontend-operator-app/
   └─ frontend-user-app/
```

## Branch Strategy

- `main`: 리뷰 후 병합되는 기본 브랜치
- `feature/aws-network`: 인프라 1 네트워크 작업
- `feature/aws-compute`: 인프라 2 플랫폼 작업
- `feature/aws-data`: 인프라 3 데이터 계층 작업
- `feature/aws-dashboard-cicd`: 인프라 4 배포 및 CI/CD 작업

## Infra 1 Quick Start

1. `docs/network-matrix.md`에서 CIDR, AZ, 보안그룹 규칙을 팀 기준으로 확정합니다.
2. `infra/aws/terraform/network/terraform.tfvars.example`를 복사해 실제 값으로 수정합니다.
3. `infra/aws/terraform/network`에서 Terraform plan으로 네트워크 베이스라인을 검증합니다.
4. ALB Listener, Target Group, WAF 연동은 플랫폼/배포 흐름이 정리된 뒤 이어서 붙입니다.

## Notes

- 시크릿, 실제 관리자 IP, 실제 계정 정보는 커밋하지 않습니다.
- `docs/*`는 발표 자료 초안이 아니라 구현 기준 문서로 유지합니다.
- `infra/aws/terraform/network`는 현재 VPC, 서브넷, 라우팅, NAT, S3 Endpoint, 보안그룹, ALB 베이스라인까지 포함합니다.
