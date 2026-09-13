#!/usr/bin/env bash
#
# Agent Manager e2e smoke — build artifacts + contracts/server entrypoints exist.
# Usage: ./scripts/e2e.sh
#

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Quantum Agent Manager e2e smoke (root: $ROOT)"
bash "$ROOT/scripts/verify.sh"

# Runtime entrypoints must load without throwing on import of the package surface.
node --input-type=module -e "
import { access } from 'node:fs/promises';
await access('apps/server/dist/index.mjs');
await access('apps/desktop/dist-electron/main.js');
console.log('  ok  server + desktop entrypoints readable');
"

echo ""
echo "Agent Manager e2e smoke passed."
