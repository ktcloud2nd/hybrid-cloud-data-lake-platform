# GitHub Workflows

`.github/workflows` 디렉터리에는 AWS 인프라 배포, Azure 인프라 배포, 웹 애플리케이션 이미지 배포를 담당하는 GitHub Actions 워크플로가 있습니다.

## aws-deploy.yml

AWS 인프라를 배포하거나 제거하는 수동 실행 워크플로입니다.

### 실행 방식

- `workflow_dispatch`로 실행합니다.
- 입력값 `action`을 선택합니다.
  - `apply`: Terraform plan 후 AWS 인프라 적용
  - `ansible`: 현재 파일 기준으로는 별도 job이 연결되어 있지 않음
  - `destroy`: AWS 인프라 제거

### 주요 작업

- `infra/aws/terraform/network`, `compute`, `data`, `alerts` 모듈을 순서대로 초기화하고 적용합니다.
- `compute`, `data`, `alerts`의 `terraform.tfvars.example`에서 실제 `terraform.tfvars`를 생성하고 GitHub Secrets 값을 주입합니다.
- `infra/aws/lambda/slack-anomaly-notifier`의 의존성을 설치한 뒤 alerts 모듈과 함께 배포합니다.
- 배포 후 Lambda Function URL invoke 권한을 AWS CLI로 후처리합니다.

### 사용되는 주요 Secrets / Variables

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `K3S_TOKEN`
- `RDS_PASSWORD`
- `SLACK_WEBHOOK_URL`
- `ANOMALY_WEBHOOK_TOKEN`
- `vars.AWS_REGION`
- `vars.PUBLIC_HOSTED_ZONE_NAME`

## aws-app-deploy.yml

웹 플랫폼 이미지를 Docker Hub에 빌드하고 푸시하는 수동 실행 워크플로입니다.

### 실행 방식

- `workflow_dispatch`로 실행합니다.

### 주요 작업

- 아래 5개 이미지를 matrix 방식으로 병렬 빌드합니다.
  - `login-backend`
  - `user-backend`
  - `operator-backend`
  - `user-frontend`
  - `operator-frontend`
- 각 서비스는 `APP_TARGET` 또는 Nginx/Vite 빌드 인자를 다르게 주입해 같은 코드베이스에서 목적별 이미지를 만듭니다.
- Docker Hub에 `sha-<commit>` 태그와 `latest` 태그로 푸시합니다.

### 사용되는 주요 Secrets / Variables

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `vars.USER_APP_URL`
- `vars.OPERATOR_APP_URL`

## azure-deploy.yml

Azure 측 브로커/컨슈머 인프라를 만들고, Azure VM 구성과 데이터 파이프라인 연결까지 수행하는 수동 실행 워크플로입니다.

### 실행 방식

- `workflow_dispatch`로 실행합니다.
- 입력값 `action`을 선택합니다.
  - `apply`: 이미지 빌드, Azure Terraform 적용, Bastion runner 설치, Azure VM Ansible 구성
  - `destroy`: Azure Terraform 리소스 제거

### 주요 작업

#### 1. 이미지 빌드

- Kafka Connect용 커스텀 이미지를 빌드해 Docker Hub에 푸시합니다.
- Edge Simulator 이미지를 빌드해 Docker Hub에 푸시합니다.

#### 2. Azure Terraform 적용

- `infra/azure/terraform`을 기준으로 Bastion, Broker, Consumer VM과 관련 리소스를 생성하거나 삭제합니다.
- apply 시 bastion IP, broker IP, consumer IP 등 출력값을 다음 job으로 전달합니다.

#### 3. Bastion self-hosted runner 설치

- Bastion VM에 SSH로 접속합니다.
- GitHub repository runner registration token을 발급받아 self-hosted runner를 설치합니다.

#### 4. Azure VM 구성

- Bastion runner에서 Ansible과 Terraform을 설치합니다.
- Azure VM용 inventory를 동적으로 생성합니다.
- AWS `data`와 `alerts` Terraform output에서 `db_endpoint`, `lambda_function_url`을 읽어옵니다.
- Azure Ansible playbook을 실행해 Kafka Broker, Kafka Connect Consumer, connector 설정을 적용합니다.

### AWS와 연결되는 지점

- Azure Consumer는 AWS RDS endpoint를 전달받아 JDBC sink로 차량 상태/이상 탐지 데이터를 적재합니다.
- Azure Ansible 실행 시 AWS Lambda Function URL도 함께 전달되어 이상 탐지 알림 연동에 사용됩니다.

### 사용되는 주요 Secrets / Variables

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_TENANT_ID`
- `AZURE_PUBLIC_KEY`
- `AZURE_PRIVATE_KEY`
- `ONPREM_SOURCE_IP`
- `MY_GITHUB_TOKEN`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `vars.AWS_REGION`

## 어떤 워크플로를 언제 쓰는가

- AWS 인프라를 새로 만들거나 갱신할 때: `aws-deploy.yml`
- 웹 백엔드/프론트 이미지 새 버전을 올릴 때: `aws-app-deploy.yml`
- Azure 브로커/컨슈머 환경과 Edge 연계 구성을 만들거나 갱신할 때: `azure-deploy.yml`
