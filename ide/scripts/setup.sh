#!/usr/bin/env bash
#
# End-to-end dev setup for Quantum (macOS / Linux).
#
# Steps: Node (.nvmrc) → Python (node-gyp) → npm install → compile → code.sh
#
# Usage:
#   ./scripts/setup.sh                    Full setup + launch
#   ./scripts/setup.sh --setup-only       Install + compile, no launch
#   ./scripts/setup.sh --launch-only      Launch only (after a successful setup)
#   ./scripts/setup.sh --skip-install     Skip npm install
#   ./scripts/setup.sh --skip-compile     Skip compile (requires existing out/)
#   ./scripts/setup.sh -- --disable-extensions   Args after -- go to code.sh
#   ./scripts/setup.sh -h | --help        Show usage
#

set -euo pipefail

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname "$(dirname "$(realpath "$0")")")
else
	ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
fi

SETUP_ONLY=false
LAUNCH_ONLY=false
SKIP_INSTALL=false
SKIP_COMPILE=false
CODE_ARGS=()
PARSE_SETUP_FLAGS=true

usage() {
	echo "Quantum dev setup (macOS / Linux)"
	echo ""
	echo "./scripts/setup.sh                 Install, compile, and launch"
	echo "./scripts/setup.sh --setup-only    Install and compile only"
	echo "./scripts/setup.sh --launch-only   Launch only (skip install/compile)"
	echo "./scripts/setup.sh --skip-install  Skip npm install"
	echo "./scripts/setup.sh --skip-compile  Skip compile"
	echo "./scripts/setup.sh -- [args...]    Pass args to scripts/code.sh"
	echo ""
	echo "Environment (set automatically when possible):"
	echo "  Node.js     version from .nvmrc (22.22.1)"
	echo "  PYTHON      3.10-3.13 for native modules (3.14 breaks node-gyp on macOS)"
	echo "  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 during install (run npm run playwright-install for tests)"
	echo ""
	echo "Windows: use scripts\\setup.bat"
	echo ""
	echo "See README.md#getting-started for prerequisites and troubleshooting."
}

for arg in "$@"; do
	if [[ "$PARSE_SETUP_FLAGS" != "true" ]]; then
		CODE_ARGS+=("$arg")
		continue
	fi
	case "$arg" in
		-h|--help)
			usage
			exit 0
			;;
		--setup-only)
			SETUP_ONLY=true
			;;
		--launch-only)
			LAUNCH_ONLY=true
			SKIP_INSTALL=true
			SKIP_COMPILE=true
			;;
		--skip-install)
			SKIP_INSTALL=true
			;;
		--skip-compile)
			SKIP_COMPILE=true
			;;
		--)
			PARSE_SETUP_FLAGS=false
			;;
			*)
			CODE_ARGS+=("$arg")
			;;
	esac
done

log_step() {
	echo ""
	echo "==> $1"
	echo ""
}

die() {
	echo "error: $*" >&2
	exit 1
}

ensure_repo_root() {
	if [[ ! -f "$ROOT/package.json" ]] || ! grep -q '"name": "quantum"' "$ROOT/package.json" 2>/dev/null; then
		die "Run this script from the Quantum repository (expected package name 'quantum' in package.json)."
	fi
}

ensure_node() {
	local required
	required=$(tr -d '[:space:]' < "$ROOT/.nvmrc")

	if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
		# shellcheck disable=SC1090
		source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
		log_step "Node.js ${required} (nvm)"
		nvm install "$required"
		nvm use "$required"
		return
	fi

	if command -v fnm >/dev/null 2>&1; then
		# shellcheck disable=SC1090
		eval "$(fnm env --shell bash 2>/dev/null || fnm env)"
		log_step "Node.js ${required} (fnm)"
		fnm install "$required" --if-not-present
		fnm use "$required"
		return
	fi

	log_step "Checking Node.js (required: v${required})"
	cd "$ROOT"
	node -e "
const fs = require('fs');
const required = fs.readFileSync('.nvmrc', 'utf8').trim();
const match = /^(\d+)\.(\d+)\.(\d+)/.exec(required);
if (!match) {
	console.error('Unable to parse .nvmrc');
	process.exit(1);
}
const [reqMajor, reqMinor, reqPatch] = match.slice(1).map(Number);
const cur = /^(\d+)\.(\d+)\.(\d+)/.exec(process.versions.node);
const [curMajor, curMinor, curPatch] = cur.slice(1).map(Number);
if (
	curMajor !== reqMajor ||
	curMinor < reqMinor ||
	(curMinor === reqMinor && curPatch < reqPatch)
) {
	console.error('Node.js v' + process.versions.node + ' does not satisfy v' + required + ' (.nvmrc).');
	console.error('Install nvm (https://github.com/nvm-sh/nvm) and run: nvm install && nvm use');
	process.exit(1);
}
" || die "Node.js version check failed. See README prerequisites."
}

ensure_npm() {
	command -v npm >/dev/null 2>&1 || die "npm is not on PATH."

	local major minor
	IFS=. read -r major minor _ <<< "$(npm --version)"

	if (( major > 11 || (major == 11 && minor >= 2) )); then
		die "npm v$(npm --version) is not supported (requires npm < 11.2). Use the npm bundled with Node $(tr -d '[:space:]' < "$ROOT/.nvmrc") via nvm."
	fi
}

# node-gyp on macOS uses gyp-mac-tool (plistlib). Python 3.14+ breaks there; cap at 3.13.
python_is_usable() {
	local bin="$1"
	[[ -x "$bin" ]] || return 1

	if [[ "$OSTYPE" == "darwin"* ]]; then
		"$bin" -c 'import sys, plistlib; sys.exit(1 if sys.version_info < (3, 10) or sys.version_info >= (3, 14) else 0)' 2>/dev/null
	else
		"$bin" -c 'import sys; sys.exit(1 if sys.version_info < (3, 10) or sys.version_info >= (3, 14) else 0)' 2>/dev/null
	fi
}

ensure_python() {
	if [[ "$SKIP_INSTALL" == "true" ]]; then
		return
	fi

	local candidates=(
		python3.11
		/opt/homebrew/opt/python@3.11/bin/python3.11
		/opt/homebrew/bin/python3.11
		/usr/local/opt/python@3.11/bin/python3.11
		/usr/local/bin/python3.11
		python3.12
		/opt/homebrew/opt/python@3.12/bin/python3.12
		/opt/homebrew/bin/python3.12
		/usr/local/opt/python@3.12/bin/python3.12
		python3.13
		/opt/homebrew/opt/python@3.13/bin/python3.13
		/opt/homebrew/bin/python3.13
	)

	local bin
	for bin in "${candidates[@]}"; do
		if python_is_usable "$bin"; then
			export PYTHON="$bin"
			export npm_config_python="$bin"
			log_step "Python for native modules ($("$bin" --version 2>&1))"
			return
		fi
	done

	if [[ "$OSTYPE" == "darwin"* ]]; then
		die "Python 3.10-3.13 required for native npm modules (3.14 breaks node-gyp on macOS). Install: brew install python@3.11"
	fi
	die "Python 3.10-3.13 required for native npm modules. Install Python 3.11 and ensure python3.11 is on PATH."
}

clear_stale_playwright_lock() {
	local lock="${HOME}/Library/Caches/ms-playwright/__dirlock"
	if [[ -e "$lock" ]]; then
		echo "Removing stale Playwright cache lock (left by an interrupted install)..."
		rm -rf "$lock"
	fi
}

fix_npm_bin_permissions() {
	if [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]] || [[ ! -d "$ROOT/node_modules" ]]; then
		return
	fi
	# Reuse postinstall logic: skip broken symlinks instead of aborting setup.
	node "$ROOT/build/npm/postinstall.ts" --fix-bin-permissions-only || true
}

ensure_compiled_output() {
	if [[ "$SKIP_COMPILE" == "true" ]]; then
		[[ -f "$ROOT/out/main.js" ]] || die "--skip-compile requires an existing build (missing out/main.js). Run without --skip-compile first."
	fi
}

launch_quantum() {
	log_step "Launching Quantum"
	if ((${#CODE_ARGS[@]} > 0)); then
		exec "$ROOT/scripts/code.sh" "${CODE_ARGS[@]}"
	else
		exec "$ROOT/scripts/code.sh"
	fi
}

main() {
	cd "$ROOT"
	ensure_repo_root

	echo "Quantum dev setup (root: $ROOT)"

	ensure_node
	ensure_npm
	ensure_python
	ensure_compiled_output

	if [[ "$SKIP_INSTALL" != "true" ]]; then
		clear_stale_playwright_lock
		log_step "Installing npm dependencies"
		export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
		npm install
	else
		echo "Skipping npm install (--skip-install / --launch-only)."
	fi

	fix_npm_bin_permissions

	if [[ "$SKIP_COMPILE" != "true" ]]; then
		log_step "Compiling sources (this may take several minutes)"
		npm run compile
	else
		echo "Skipping compile (--skip-compile / --launch-only)."
	fi

	if [[ "$SETUP_ONLY" == "true" ]]; then
		echo ""
		echo "Setup complete."
		echo "  Launch:     ./scripts/code.sh"
		echo "  Fast path:  ./scripts/setup.sh --launch-only"
		echo "  Relaunch:   VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh"
		echo "  Watch:      npm run watch  (separate terminal)"
		return 0
	fi

	launch_quantum
}

main
