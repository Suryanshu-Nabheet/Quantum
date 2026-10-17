#!/usr/bin/env bash
# Ensures agent GUI can run vitest harness (local packages built).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT="$ROOT/ide/src/vs/workbench/contrib/agent"
cd "$AGENT"
if [[ ! -d gui/node_modules ]]; then
	echo "Installing agent GUI dependencies..."
	npm install --prefix gui
fi
if [[ ! -d "$ROOT/ide/out/agent-packages/fetch" ]]; then
	echo "Building agent packages (first run)..."
	node scripts/build-packages.js || {
		echo "eval prereq: build-packages failed — run: cd $AGENT && npm install && node scripts/build-packages.js" >&2
		exit 1
	}
fi
