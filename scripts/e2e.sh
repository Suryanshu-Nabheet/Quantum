#!/usr/bin/env bash
#
# Quantum monorepo end-to-end smoke checks — Agent Manager + IDE
#
# Usage:
#   ./scripts/e2e.sh
#   ./scripts/e2e.sh --only ide
#   ./scripts/e2e.sh --skip-agent
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
Quantum monorepo end-to-end smoke tests

Options:
--skip-ide       Skip IDE e2e
--skip-agent     Skip Agent Manager e2e
--only agent|ide Run e2e for one subsystem only
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

e2e_agent() {
	log_step "E2E: Quantum Agent Manager"
	if [[ -f "${ROOT}/agent/scripts/e2e.sh" ]]; then
		(
			cd "${ROOT}/agent"
			bash scripts/e2e.sh
		) && log_ok "Agent Manager e2e passed" || FAILED=1
	else
		log_warn "agent/scripts/e2e.sh not found — skipping"
	fi
}

e2e_ide() {
	log_step "E2E: Quantum IDE"
	if [[ -f "${ROOT}/ide/scripts/e2e.sh" ]]; then
		(
			cd "${ROOT}/ide"
			bash scripts/e2e.sh
		) && log_ok "IDE e2e passed" || FAILED=1
	else
		log_warn "ide/scripts/e2e.sh not found — skipping"
	fi
}

if [[ "$SKIP_AGENT" -eq 0 ]]; then
	e2e_agent
else
	log_warn "Skipping Agent Manager e2e"
fi

if [[ "$SKIP_IDE" -eq 0 ]]; then
	e2e_ide
else
	log_warn "Skipping IDE e2e"
fi

echo ""
if [[ "$FAILED" -eq 0 ]]; then
	echo -e "${C_GREEN}${C_BOLD}All e2e checks passed.${C_RESET}"
	exit 0
else
	echo -e "${C_RED}${C_BOLD}E2E checks failed.${C_RESET}" >&2
	exit 1
fi
