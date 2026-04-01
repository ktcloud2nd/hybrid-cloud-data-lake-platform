# Workflows

AWS 배포 워크플로는 `.github/workflows/aws-deploy.yml`을 사용합니다.

플랫폼 배포와 관련해 추가로 쓰는 주요 GitHub Actions 변수/시크릿 메모:

- `GRAFANA_EMBED_URL`
  - 기본값은 `/grafana/d/k3s-infra-draft/k3s-infra-overview-draft?orgId=1&kiosk`
  - 이 값은 파일 구조만 다시 보면 추론 가능합니다.
  - 근거 파일:
    - `infra/aws/ansible/roles/prometheus/files/grafana-dashboards/k3s-infra-overview.json`
      - dashboard `uid`: `k3s-infra-draft`
      - dashboard `title`: `K3s Infra Overview (Draft)`
    - `k8s/frontend-operator-app/grafana-ingress.yml`
      - Grafana ingress path: `/grafana`
    - `infra/aws/ansible/roles/prometheus/tasks/main.yml`
      - Grafana subpath serve 설정 적용

- `QUICKSIGHT_*`
  - 기본값으로 추론할 수 없고 실제 AWS QuickSight 리소스 값이 필요합니다.
