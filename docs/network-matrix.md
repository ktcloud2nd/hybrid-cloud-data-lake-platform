# Network Matrix

## Baseline Assumption

아래 값은 인프라 1 작업을 바로 시작하기 위한 초안입니다. 팀 합의 후 실제 값으로 고정합니다.

| Item | Value |
| --- | --- |
| AWS Region | `ap-northeast-2` |
| VPC CIDR | `10.20.0.0/16` |
| Availability Zones | `ap-northeast-2a`, `ap-northeast-2c` |
| NAT Strategy | AZ별 NAT Gateway 1개 |
| Internet Entry | `ALB` |
| S3 Access | `Gateway VPC Endpoint` |

## Subnet Plan

| Subnet | AZ | CIDR | Purpose | Route |
| --- | --- | --- | --- | --- |
| Public-A | `ap-northeast-2a` | `10.20.0.0/24` | ALB, NAT, Bastion | IGW |
| Public-C | `ap-northeast-2c` | `10.20.1.0/24` | ALB, NAT | IGW |
| Private-App-A | `ap-northeast-2a` | `10.20.10.0/24` | K3s master/worker | NAT-A |
| Private-App-C | `ap-northeast-2c` | `10.20.11.0/24` | K3s worker | NAT-C |
| Private-DB-A | `ap-northeast-2a` | `10.20.20.0/24` | RDS primary 후보 | Local only |
| Private-DB-C | `ap-northeast-2c` | `10.20.21.0/24` | RDS standby 후보 | Local only |

## Security Group Draft

| SG | Inbound | Source | Outbound |
| --- | --- | --- | --- |
| `alb-sg` | `80`, `443` | `0.0.0.0/0` | `k3s-nodes-sg` |
| `bastion-sg` | `22` | 관리자 공인 IP | All |
| `k3s-nodes-sg` | `80`, `443` | `alb-sg` | All |
| `k3s-nodes-sg` | `22` | `bastion-sg` | All |
| `k3s-nodes-sg` | All | VPC CIDR | All |
| `db-sg` | `5432` | `k3s-nodes-sg` | 제한적 또는 기본 egress |

## Route Table Draft

| Route Table | Attached Subnet | Default Route |
| --- | --- | --- |
| `public-rt` | Public-A, Public-C | `0.0.0.0/0 -> IGW` |
| `private-app-rt-a` | Private-App-A | `0.0.0.0/0 -> NAT-A` |
| `private-app-rt-c` | Private-App-C | `0.0.0.0/0 -> NAT-C` |
| `private-db-rt-a` | Private-DB-A | 없음 |
| `private-db-rt-c` | Private-DB-C | 없음 |

## Networking Checklist

- VPC CIDR 최종 승인
- 관리자 IP 목록 수집
- NAT 1개 vs 2개 비용/가용성 확정
- ALB Public Subnet 배치 검토
- S3 Gateway Endpoint 연결 라우트 검증
- RDS DB Subnet Group 대상 서브넷 재확인
