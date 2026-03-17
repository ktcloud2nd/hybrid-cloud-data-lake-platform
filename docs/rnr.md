# R&R

## Role Assignment

| Role | Owner | Scope | Output |
| --- | --- | --- | --- |
| 인프라 1 | 윤승호 | VPC, Subnet, Route, IGW, NAT, S3 Endpoint, SG, ALB | Terraform network, 네트워크 다이어그램, SG 규칙표 |
| 인프라 2 | 이우열 | EC2, Launch Template, ASG, K3s, Linkerd, Ansible | Terraform compute, Ansible playbooks, K3s 설치 문서 |
| 인프라 3 | 민성경 | S3, RDS, DB Subnet Group, import job, serving schema | Terraform data, import 스크립트, 샘플 import 결과 |
| 인프라 4 | 윤재호 | Dashboard 배포, GitHub Actions, 헬스체크 | 워크플로, 배포 문서, 점검 체크리스트 |

## Working Rule

- 최종 책임자는 역할별 1명으로 고정
- `main` 직접 push 금지
- 모든 작업은 feature 브랜치에서 진행
- 문서 기준이 먼저, 구현은 그 다음
- 인프라 변경과 앱 배포 변경은 분리

## Phase Summary

### Phase 1

- 문서 고정
- VPC CIDR, Subnet 구조, SG 초안 확정
- import 포맷, 테이블 초안 정리

### Phase 2

- Terraform 네트워크 베이스라인 생성
- S3, RDS, DB Subnet Group 생성 준비
- EC2/K3s 사양 및 설치 방식 정리

### Phase 3

- ALB, Target Group, EC2 연동
- K3s/Linkerd 구성
- S3 -> RDS import 검증

### Phase 4

- GitHub Actions 도입
- 앱 배포 자동화
- import job 자동화

### Phase 5

- 운영 체크리스트 정리
- 복구 절차 정리
- 데모/발표 시나리오 정리
