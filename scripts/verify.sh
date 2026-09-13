#!/usr/bin/env bash
#
# Quantum monorepo verification — Agent Manager + IDE
#
# Usage:
#   ./scripts/verify.sh
#   ./scripts/verify.sh --skip-ide
#   ./scripts/verify.sh --only agent
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ROOT="$(quantum_repo_root)"
SKIP_IDE=0
SKIP_AGENT=0
ONLY=""

while [[ $# -gt 0 ]]; do
	case "$1" in
		--skip-ide) SKIP_IDE=1 ;;
		--skip-agent) SKIP_AGENT=1 ;;
		--only)
			shift
			ONLY="${1:-}"
			[[ -n "$ONLY" ]] || die "--only requires a value (agent|ide)"
			;;
		-h|--help)
			cat <<'EOF'
Quantum monorepo verification

Options:
--skip-ide       Skip IDE checks
--skip-agent     Skip Agent Manager checks
--only agent|ide Run checks for one subsystem only
-h, --help       Show this help
EOF
			exit 0
			;;
		*)
			die "Unknown option: $1 (try --help)"
			;;
	esac
	shift
done

case "$ONLY" in
	"") ;;
	agent) SKIP_IDE=1 ;;
	ide) SKIP_AGENT=1 ;;
	*) die "Invalid --only value: $ONLY (use agent or ide)" ;;
esac

print_setup_banner "$ROOT"
ensure_repo_layout "$ROOT"
ensure_bun
ensure_node_min "$QUANTUM_NODE_MIN_MAJOR"

FAILED=0

verify_agent() {
	log_step "Verifying Quantum Agent Manager"
	if [[ -f "${ROOT}/agent/scripts/verify.sh" ]]; then
		(
			cd "${ROOT}/agent"
			bash scripts/verify.sh
		) && log_ok "Agent Manager verification passed" || FAILED=1
	else
		log_warn "agent/scripts/verify.sh not found — skipping"
	fi
}

verify_ide() {
	log_step "Verifying Quantum IDE"
	if [[ -f "${ROOT}/ide/scripts/verify-dev.sh" ]]; then
		(
			cd "${ROOT}/ide"
			bash scripts/verify-dev.sh
		) && log_ok "IDE verification passed" || FAILED=1
	elif [[ -f "${ROOT}/ide/scripts/verify.sh" ]]; then
		(
			cd "${ROOT}/ide"
			bash scripts/verify.sh
		) && log_ok "IDE verification passed" || FAILED=1
	else
		log_warn "ide/scripts/verify-dev.sh not found — skipping"
	fi
}

if [[ "$SKIP_AGENT" -eq 0 ]]; then
	verify_agent
else
	log_warn "Skipping Agent Manager verification"
fi

if [[ "$SKIP_IDE" -eq 0 ]]; then
	verify_ide
else
	log_warn "Skipping IDE verification"
fi

echo ""
if [[ "$FAILED" -eq 0 ]]; then
	echo -e "${C_GREEN}${C_BOLD}All verification checks passed.${C_RESET}"
	exit 0
else
	echo -e "${C_RED}${C_BOLD}Verification failed.${C_RESET}" >&2
	exit 1
fi
