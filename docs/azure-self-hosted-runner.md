# Azure Self-Hosted Runner 운영 가이드

## 목표

- Azure 인프라 생성, Bastion runner 설치, VM 환경 구성을 하나의 workflow에서 처리
- Broker / Consumer VM은 private IP SSH만 허용
- 수동 SSH 없이 배포 시 Bastion에 self-hosted runner가 자동 설치되도록 구성

## 현재 배포 흐름

1. GitHub Actions에서 `.github/workflows/azure-deploy.yml` 실행
2. Terraform이 Bastion, Broker, Consumer를 생성
3. GitHub-hosted runner가 Bastion에 SSH 접속해 self-hosted runner를 자동 설치
4. 같은 workflow의 다음 job이 Bastion self-hosted runner에서 실행
5. Ansible이 Broker / Consumer private IP로 접속해 환경 구성

## 필요한 GitHub Secrets

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_TENANT_ID`
- `AZURE_PUBLIC_KEY`
- `AZURE_PRIVATE_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `ONPREM_SOURCE_IP`
- `MY_GITHUB_TOKEN`

## MY_GITHUB_TOKEN 용도

- workflow가 GitHub API를 호출해 Bastion용 self-hosted runner registration token을 자동 발급할 때 사용
- classic PAT 기준 `repo` 권한이 있으면 보통 사용 가능

## 사용 파일

- 메인 workflow: `.github/workflows/azure-deploy.yml`
- runner 설치 스크립트: `infra/azure/scripts/install-self-hosted-runner.sh`
- 네트워크 정책: `infra/azure/terraform/network.tf`

## 주의 사항

- Bastion은 외부 SSH 진입점 역할을 유지
- Broker / Consumer는 VNet 내부 SSH만 허용
- Kafka Connect 8083은 외부 공개하지 않음
- self-hosted runner 설치가 끝나야 Ansible job이 이어서 실행됨
