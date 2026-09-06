#!/usr/bin/env bash
#
# Verify Quantum monorepo dev environment after setup.
# Exit 0 when all selected checks pass; exit 1 otherwise.
#
# Usage:
#   ./scripts/verify.sh
#   ./scripts/verify.sh --skip-ide
#   ./scripts/verify.sh --only cli
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ROOT="$(quantum_repo_root)"
cd "$ROOT"

VERIFY_CLI=true
VERIFY_AGENT=true
VERIFY_IDE=true
FAIL=0

usage() {
	cat <<'EOF'
Verify Quantum ecosystem setup

./scripts/verify.sh
./scripts/verify.sh --skip-ide
./scripts/verify.sh --skip-agent
./scripts/verify.sh --skip-cli
./scripts/verify.sh --only cli|agent|ide
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		-h|--help)
			usage
			exit 0
			;;
		--skip-cli)
			VERIFY_CLI=false
			;;
		--skip-agent)
			VERIFY_AGENT=false
			;;
		--skip-ide)
			VERIFY_IDE=false
			;;
		--only)
			shift
			case "${1:-}" in
				cli)
					VERIFY_CLI=true
					VERIFY_AGENT=false
					VERIFY_IDE=false
					;;
				agent)
					VERIFY_CLI=false
					VERIFY_AGENT=true
					VERIFY_IDE=false
					;;
				ide)
					VERIFY_CLI=false
					VERIFY_AGENT=false
					VERIFY_IDE=true
					;;
				*)
					die "Unknown --only target: ${1:-}"
					;;
			esac
			;;
		*)
			die "Unknown argument: $1"
			;;
	esac
	shift
done

check() {
	local label="$1"
	shift
	if "$@"; then
		log_ok "$label"
	else
		log_fail "$label"
		FAIL=1
	fi
}

echo ""
echo -e "${C_BOLD}Quantum ecosystem verification${C_RESET}"
echo -e "${C_DIM}Root: ${ROOT}${C_RESET}"
echo ""

ensure_repo_layout "$ROOT" || FAIL=1

if [[ "$VERIFY_CLI" == "true" ]]; then
	echo -e "${C_BOLD}CLI${C_RESET}"
	check "cli/node_modules present" test -d cli/node_modules
	check "cli/dist/cli.mjs built" test -f cli/dist/cli.mjs
	if [[ -f cli/dist/cli.mjs ]]; then
		check "cli --version runs" node cli/dist/cli.mjs --version >/dev/null 2>&1
	fi
	echo ""
fi

if [[ "$VERIFY_AGENT" == "true" ]]; then
	echo -e "${C_BOLD}Agent Manager${C_RESET}"
	check "agent/node_modules present" test -d agent/node_modules
	check "agent contracts built" test -f agent/packages/contracts/dist/index.mjs
	check "agent server built" test -f agent/apps/server/dist/index.mjs
	check "agent web built" test -d agent/apps/web/dist
	check "agent desktop built" test -f agent/apps/desktop/dist-electron/main.js
	echo ""
fi

if [[ "$VERIFY_IDE" == "true" ]]; then
	echo -e "${C_BOLD}IDE${C_RESET}"
	if [[ -x ide/scripts/verify-dev.sh ]]; then
		if ide/scripts/verify-dev.sh; then
			log_ok "ide/scripts/verify-dev.sh"
		else
			log_fail "ide/scripts/verify-dev.sh"
			FAIL=1
		fi
	else
		check "ide/node_modules present" test -d ide/node_modules
		check "ide/out/main.js compiled" test -f ide/out/main.js
	fi
	echo ""
fi

if (( FAIL == 0 )); then
	echo -e "${C_GREEN}${C_BOLD}All checks passed.${C_RESET}"
	exit 0
fi

echo -e "${C_RED}${C_BOLD}Some checks failed.${C_RESET} Re-run: ${ROOT}/scripts/setup.sh"
exit 1
