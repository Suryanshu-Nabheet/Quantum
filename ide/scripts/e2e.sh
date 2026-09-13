#!/usr/bin/env bash
#
# IDE e2e smoke — verify-dev + agent/browserView compile artifacts.
# Usage: ./scripts/e2e.sh
#

set -euo pipefail

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname "$(dirname "$(realpath "$0")")")
else
	ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
fi

cd "$ROOT"
FAIL=0

pass() { echo "  ok  $1"; }
fail() { echo "  FAIL  $1"; FAIL=1; }

echo "Quantum IDE e2e smoke (root: $ROOT)"
bash "$ROOT/scripts/verify-dev.sh"

echo ""
echo "Agent + browser integration artifacts"

if [[ -f out/agent/package.json && -f out/agent/out/extension.js ]]; then
	pass "built-in agent extension (out/agent)"
else
	fail "out/agent extension missing — run npm run compile / compile-agent"
fi

if [[ -d out/agent/webview ]]; then
	pass "agent GUI webview (out/agent/webview)"
else
	fail "out/agent/webview missing"
fi

if [[ -d out/vs/workbench/contrib/browserView ]]; then
	pass "browserView contrib compiled"
else
	fail "out/vs/workbench/contrib/browserView missing"
fi

if [[ -d out/vs/workbench/contrib/agent ]]; then
	pass "agent workbench contrib compiled"
else
	fail "out/vs/workbench/contrib/agent missing"
fi

echo ""
echo "Watch pipeline (src → out incremental)"
if bash "$ROOT/scripts/verify-watch.sh"; then
	pass "transpile --watch updates out/"
else
	fail "transpile --watch did not update out/"
fi

echo ""
if (( FAIL == 0 )); then
	echo "IDE e2e smoke passed."
	exit 0
fi

echo "Fix the failures above, then rerun: ./scripts/e2e.sh"
exit 1
