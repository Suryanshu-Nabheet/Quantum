#!/usr/bin/env bash
#
# Verify local dev environment is ready to build and run Quantum.
# Exit 0 = all checks passed. Exit 1 = fix issues printed below.
#
# Usage: ./scripts/verify-dev.sh
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

echo "Quantum dev verification (root: $ROOT)"
echo ""

# Node
REQUIRED=$(tr -d '[:space:]' < .nvmrc)
if command -v node >/dev/null 2>&1; then
	if node -e "
const fs=require('fs');const r=fs.readFileSync('.nvmrc','utf8').trim();
const m=/^(\\d+)\\.(\\d+)\\.(\\d+)/.exec(r);const[rm,ri,rp]=m.slice(1).map(Number);
const c=/^(\\d+)\\.(\\d+)\\.(\\d+)/.exec(process.versions.node);const[cm,ci,cp]=c.slice(1).map(Number);
process.exit(cm!==rm||ci<ri||(ci===ri&&cp<rp)?1:0);
" 2>/dev/null; then
		pass "Node.js $(node -v) (requires v${REQUIRED})"
	else
		fail "Node.js $(node -v) does not satisfy v${REQUIRED} (.nvmrc)"
	fi
else
	fail "node not found"
fi

# npm
if command -v npm >/dev/null 2>&1; then
	major=$(npm --version | cut -d. -f1)
	minor=$(npm --version | cut -d. -f2)
	if (( major > 11 || (major == 11 && minor >= 2) )); then
		fail "npm $(npm --version) unsupported (need below 11.2)"
	else
		pass "npm $(npm --version)"
	fi
else
	fail "npm not found"
fi

# Dependencies
if [[ -d node_modules ]]; then
	pass "node_modules present"
else
	fail "node_modules missing - run ./scripts/setup.sh --setup-only"
fi

# Build output
if [[ -f out/main.js ]]; then
	pass "compiled output (out/main.js)"
else
	fail "out/main.js missing - run npm run compile or ./scripts/setup.sh --setup-only"
fi

# npm bin permissions
if [[ "$OSTYPE" != "msys"* && "$OSTYPE" != "cygwin"* && -L node_modules/.bin/npm-run-all2 ]]; then
	target=$(readlink node_modules/.bin/npm-run-all2)
	resolved="$ROOT/node_modules/.bin/$target"
	[[ "$target" == /* ]] && resolved="$target"
	if [[ -x "$resolved" || -x "$ROOT/node_modules/npm-run-all2/bin/npm-run-all/index.js" ]]; then
		pass "npm bin scripts executable"
	else
		fail "npm bin scripts not executable - run node build/npm/postinstall.ts"
	fi
fi

# Typecheck (optional quick signal)
if npm run compile-check-ts-native >/dev/null 2>&1; then
	pass "TypeScript check (src/)"
else
	fail "TypeScript check failed - run npm run compile-check-ts-native"
fi

echo ""
if (( FAIL == 0 )); then
	echo "All checks passed. Launch with: ./scripts/setup.sh --launch-only"
	exit 0
fi

echo "Fix the failures above, then rerun: ./scripts/verify-dev.sh"
echo "Full setup: ./scripts/setup.sh --setup-only"
exit 1
