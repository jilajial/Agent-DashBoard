#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if ! command -v node >/dev/null; then echo "Node.js 22.13+ is required. Install Node.js LTS, then rerun this script."; exit 1; fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' || { echo "Node.js 22.13+ is required."; exit 1; }
cd "$ROOT"; exec node packages/hub/server/index.js
