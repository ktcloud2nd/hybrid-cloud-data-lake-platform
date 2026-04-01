# Azure Self-Hosted Runner 운영 가이드

## 목표

- Azure 리소스 생성은 GitHub-hosted runner에서 수행
- VM 내부 구성과 Ansible 실행은 Bastion VM의 self-hosted runner에서 수행
- Broker / Consumer VM은 private IP SSH만 허용

## 배포 순서

1. GitHub Actions에서 `Azure Bootstrap Deploy` workflow 실행
2. Terraform output으로 나온 Bastion 공인 IP 확인
3. Bastion VM에 접속
4. Bastion에서 self-hosted runner 설치
5. GitHub Actions에서 `Azure Configure via Bastion Runner` workflow 실행
6. Ansible이 Bastion 내부에서 Broker / Consumer private IP로 접속

## Bastion에서 runner 설치

```bash
chmod +x infra/azure/scripts/install-self-hosted-runner.sh
infra/azure/scripts/install-self-hosted-runner.sh \
  https://github.com/<org>/<repo> \
  <RUNNER_TOKEN> \
  bastion-runner
```

- 기본 label은 `azure-bastion`
- workflow는 `runs-on: [self-hosted, linux, x64, azure-bastion]`를 사용

## GitHub 저장소 설정

1. GitHub 저장소에서 `Settings -> Actions -> Runners`로 이동
2. `New self-hosted runner` 선택
3. Linux x64 기준 등록 토큰 발급
4. Bastion VM에서 설치 스크립트 실행

## 네트워크 정책

- Bastion: 외부 SSH 허용 대상
- Broker: Kafka 외부 포트만 필요한 대상에 허용, SSH는 VNet 내부만 허용
- Consumer: SSH는 VNet 내부만 허용, Kafka Connect 8083은 외부 비공개

## 주의 사항

- self-hosted runner는 Bastion VM에서 GitHub로 outbound HTTPS 통신이 가능해야 함
- `AZURE_PRIVATE_KEY`, AWS 자격 증명, Azure 자격 증명은 GitHub Secrets에 유지
- Broker / Consumer에 직접 public SSH 접속하는 구조로 되돌리지 않도록 inventory는 private IP 기준으로 유지

## 전환 체크리스트

- `Azure Bootstrap Deploy`를 먼저 실행해 Bastion, Broker, Consumer가 모두 생성됐는지 확인
- Terraform output으로 Bastion 공인 IP와 Broker / Consumer private IP를 확인
- GitHub 저장소 `Settings -> Actions -> Runners`에서 self-hosted runner 등록 토큰 발급
- Bastion VM에서 `infra/azure/scripts/install-self-hosted-runner.sh` 실행
- GitHub Actions runner label이 `azure-bastion`으로 등록됐는지 확인
- `Azure Configure via Bastion Runner` workflow를 수동 실행
- Ansible이 Broker / Consumer private IP로 정상 접속하는지 확인
- Azure NSG에서 Broker / Consumer subnet 연결이 private NSG로 바뀌었는지 확인
- Kafka 토픽 적재와 RDS 적재가 기존처럼 동작하는지 최종 확인
