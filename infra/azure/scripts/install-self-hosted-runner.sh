#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <repo-url> <runner-token> [runner-name]"
  echo "Example: $0 https://github.com/org/repo ABC123 bastion-runner"
  exit 1
fi

REPO_URL="$1"
RUNNER_TOKEN="$2"
RUNNER_NAME="${3:-$(hostname)-runner}"
RUNNER_VERSION="${RUNNER_VERSION:-2.325.0}"
RUNNER_LABELS="${RUNNER_LABELS:-azure-bastion}"
RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner}"

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [[ ! -f "./config.sh" ]]; then
  curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf actions-runner.tar.gz
fi

./config.sh \
  --url "$REPO_URL" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --unattended \
  --replace

sudo ./svc.sh install "$USER"
sudo ./svc.sh start

echo "Runner installed in $RUNNER_DIR"
echo "Labels: $RUNNER_LABELS"
