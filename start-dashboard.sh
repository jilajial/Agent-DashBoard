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
launch_hub() {
  check_node || return
  [ -f packages/hub/config/hub.local.json ] || cp packages/hub/config/hub.example.json packages/hub/config/hub.local.json
  ./scripts/start-hub.sh & sleep 2
  open_browser http://127.0.0.1:3000
}
launch_node() {
  check_node || return
  [ -f packages/node/config/node.local.json ] || cp packages/node/config/node.example.json packages/node/config/node.local.json
  ./scripts/start-node.sh & sleep 2
  open_browser http://127.0.0.1:3100
}
update_then_start() {
  if ! command -v git >/dev/null; then
    echo "Git is required for one-click updates. Install it with your system package manager, then retry."
    return
  fi
  if [ ! -d .git ]; then
    echo "This looks like a ZIP copy. Local *.local.json files are preserved; edited program files will be replaced."
    read -r -p "Enroll this copy and download the current release? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || return
    git init -q || return
    git remote add origin https://github.com/jilajial/Agent-DashBoard.git 2>/dev/null || true
    git remote set-url origin https://github.com/jilajial/Agent-DashBoard.git || return
    git fetch --quiet origin main && git reset --hard origin/main || { echo "Update failed."; return; }
  else
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
      echo "Update stopped: program files have local edits. Commit or discard them first. *.local.json settings are preserved."
      return
    fi
    git fetch --quiet origin main || { echo "Could not check GitHub."; return; }
    local count
    count="$(git rev-list --count HEAD..origin/main)"
    if [ "$count" = "0" ]; then echo "Already up to date."; else
      echo "$count update commit(s) are available."
      read -r -p "Download and apply now? [y/N] " answer
      [[ "$answer" =~ ^[Yy]$ ]] || return
      git pull --ff-only origin main || { echo "Update failed."; return; }
    fi
  fi
  printf 'Start: 1) Hub  2) Agent Node  m) Menu\n> '
  read -r target
  case "$target" in 1) launch_hub ;; 2) launch_node ;; esac
}

while true; do
  printf '\n=== AGENTS HQ LAUNCHER ===\n'
  printf '1) Start Agents HQ\n2) Start this computer Agent Node\n3) Edit Hub settings\n4) Edit Node settings\n5) Read deployment guide\n6) Check / download GitHub update, then start\nq) Exit\n> '
  read -r option
  case "$option" in
    1) launch_hub ;;
    2) launch_node ;;
    3) [ -f packages/hub/config/hub.local.json ] || cp packages/hub/config/hub.example.json packages/hub/config/hub.local.json; "${EDITOR:-nano}" packages/hub/config/hub.local.json ;;
    4) [ -f packages/node/config/node.local.json ] || cp packages/node/config/node.example.json packages/node/config/node.local.json; "${EDITOR:-nano}" packages/node/config/node.local.json ;;
    5) ${PAGER:-less} README.md ;;
    6) update_then_start ;;
    q|Q) exit 0 ;;
    *) echo "Invalid option." ;;
  esac
done
