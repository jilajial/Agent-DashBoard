#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

check_node() {
  if ! command -v node >/dev/null; then
    echo "Node.js 22.13+ is required. Install Node.js LTS and run this launcher again."
    return 1
  fi
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' || { echo "Node.js 22.13+ is required."; return 1; }
}
open_browser() { command -v xdg-open >/dev/null && xdg-open "$1" >/dev/null 2>&1 || true; }
check_node || exit 1

while true; do
  printf '\n=== PITT MEETING HUB LAUNCHER ===\n'
  printf '1) Start Pitt Meeting Hub\n2) Start this computer Agent Node\n3) Edit Hub settings\n4) Edit Node settings\n5) Read deployment guide\nq) Exit\n> '
  read -r option
  case "$option" in
    1) [ -f packages/hub/config/hub.local.json ] || cp packages/hub/config/hub.example.json packages/hub/config/hub.local.json; node packages/hub/server/index.js & sleep 2; open_browser http://127.0.0.1:3000 ;;
    2) [ -f packages/node/config/node.local.json ] || cp packages/node/config/node.example.json packages/node/config/node.local.json; node packages/node/server/index.js & sleep 2; open_browser http://127.0.0.1:3100 ;;
    3) [ -f packages/hub/config/hub.local.json ] || cp packages/hub/config/hub.example.json packages/hub/config/hub.local.json; "${EDITOR:-nano}" packages/hub/config/hub.local.json ;;
    4) [ -f packages/node/config/node.local.json ] || cp packages/node/config/node.example.json packages/node/config/node.local.json; "${EDITOR:-nano}" packages/node/config/node.local.json ;;
    5) ${PAGER:-less} README.md ;;
    q|Q) exit 0 ;;
    *) echo "Invalid option." ;;
  esac
done
