## Vehicle Edge Simulator 실행 가이드

이 가이드는 차량 단말(Edge Device) 역할을 수행하는 시뮬레이터를 로컬 환경(VirtualBox)에 설치하고, Azure 클라우드의 Kafka 브로커로 데이터를 스트리밍하는 절차를 담고 있습니다.

### 1. 설계 의도
본 시뮬레이터는 Edge-to-Cloud 하이브리드 아키텍처의 최전방 노드입니다. 클라우드 외부(Edge)에서 발생한 데이터를 실시간으로 수집하여 클라우드로 전송하는 실무 환경을 재현합니다.

### 2. 전제 조건
- **Edge Node**: VirtualBox VM (Ubuntu 등 리눅스 환경 권장)
- **네트워크**: 가상머신이 외부 인터넷(Docker Hub 접속용)에 연결된 상태
- **Azure Infra**: GitHub Actions를 통한 Terraform 배포 및 이미지 Push 완료

### 3. 실행 순서
1. **Docker 설치 (최초 1회)**<br>
   터미널에 접속하여 아래 명령어를 한 줄씩 실행하세요.
   ```bash
   # 시스템 업데이트 및 필수 패키지 설치
   sudo apt-get update
   sudo apt-get install -y ca-certificates curl gnupg

   # 도커 공식 GPG 키 및 저장소 설정
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   sudo chmod a+r /etc/apt/keyrings/docker.gpg

   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

   # 도커 엔진 설치
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

   # 현재 사용자에게 도커 권한 부여 (sudo 없이 사용하기 위함)
   sudo usermod -aG docker $USER
   newgrp docker

2. **작업 디렉토리 및 파일 생성**<br>
   프로젝트 파일을 관리할 폴더를 만들고 필요한 파일 2개를 생성합니다.
   ```bash
   # 폴더 생성 및 이동
   mkdir -p ~/vehicle-project && cd ~/vehicle-project

   # 도커 컴포즈 파일 생성 (복사 후 붙여넣기 -> :wq)
   vi docker-compose.yml

   # 시뮬레이터 파이썬 파일 생성 (복사 후 붙여넣기 -> :wq)
   vi vehicle_simulator.py

3. **실행 및 모니터링**<br>
   Terraform이 생성한 Azure 브로커 IP를 주입하고 서비스를 가동합니다.

   - **환경 변수 설정**<br>
     GitHub Actions Terraform Apply 결과 창의 broker_public_ip를 확인하세요.
     ```bash
     # 발급받은 실제 IP로 수정하여 실행
     echo "BROKER_PUBLIC_IP=xx.xx.xx.xx" > .env

   - **컨테이너 가동**
     ```bash
     # 최신 이미지 Pull 및 컨테이너 실행
     docker compose pull && docker compose up -d

   - **정상 작동 확인**<br>
     데이터가 실시간으로 전송되는지 로그를 확인합니다.
     ```bash
     docker logs -tf vehicle-simulator 2>&1 | cat -n

   - **데이터 전송 일시 중단**
     ```bash
     docker compose stop
     
   - **데이터 전송 다시 시작**
     ```bash
     docker compose start
