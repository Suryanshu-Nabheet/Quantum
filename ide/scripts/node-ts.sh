#!/usr/bin/env bash
#
# Run TypeScript build scripts with Node's native type stripping.
# All Quantum IDE dev launchers should use this instead of bare `node *.ts`.
#
# Usage:
#   ./scripts/node-ts.sh build/lib/preLaunch.ts
#   ./scripts/node-ts.sh build/lib/node.ts
#

set -euo pipefail

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT="$(cd "$(dirname "$(realpath "$0")")/.." && pwd)"
else
	ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
fi

die() {
	echo "error: $*" >&2
	exit 1
}

ensure_node_version() {
	local required
	required="$(tr -d '[:space:]' < "$ROOT/.nvmrc")"

	# Prefer nvm/fnm when available so `code.sh` works outside setup.sh.
	if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
		# shellcheck disable=SC1090
		source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
		nvm use --silent "$required" >/dev/null 2>&1 || nvm use --silent >/dev/null 2>&1 || true
	elif command -v fnm >/dev/null 2>&1; then
		# shellcheck disable=SC1090
		eval "$(fnm env --shell bash 2>/dev/null || fnm env)"
		fnm use "$required" --silent-if-installed >/dev/null 2>&1 || true
	fi

	if ! command -v node >/dev/null 2>&1; then
		die "Node.js not found. Run: cd ide && ./scripts/setup.sh --setup-only"
	fi

	if ! node -e "
const fs = require('fs');
const required = fs.readFileSync('${ROOT}/.nvmrc', 'utf8').trim();
const match = /^(\\d+)\\.(\\d+)\\.(\\d+)/.exec(required);
if (!match) process.exit(1);
const [reqMajor, reqMinor, reqPatch] = match.slice(1).map(Number);
const cur = /^(\\d+)\\.(\\d+)\\.(\\d+)/.exec(process.versions.node);
const [curMajor, curMinor, curPatch] = cur.slice(1).map(Number);
process.exit(
	curMajor !== reqMajor ||
	curMinor < reqMinor ||
	(curMinor === reqMinor && curPatch < reqPatch) ? 1 : 0
);
" 2>/dev/null; then
		die "Node.js $(node -v) does not satisfy v${required} (ide/.nvmrc). Run: cd ide && ./scripts/setup.sh --setup-only"
	fi

	# Native TS stripping landed in Node 22.6+; Quantum pins 22.22.1.
	if ! node --help 2>&1 | grep -q 'experimental-strip-types'; then
		die "Node.js $(node -v) lacks --experimental-strip-types. Upgrade to v${required} (see ide/.nvmrc)."
	fi
}

ensure_node_version
exec node --experimental-strip-types "$@"
