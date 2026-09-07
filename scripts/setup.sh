#!/usr/bin/env bash
#
# Quantum monorepo setup — Agent Manager + IDE
#
# Usage:
#   ./scripts/setup.sh
#   ./scripts/setup.sh --skip-ide
#   ./scripts/setup.sh --skip-agent
#   ./scripts/setup.sh --launch-ide
#   ./scripts/setup.sh --launch-agent
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ROOT="$(quantum_repo_root)"
SKIP_IDE=0
SKIP_AGENT=0
LAUNCH_IDE=0
LAUNCH_AGENT=0

while [[ $# -gt 0 ]]; do
	case "$1" in
		--skip-ide) SKIP_IDE=1 ;;
		--skip-agent) SKIP_AGENT=1 ;;
		--launch-ide) LAUNCH_IDE=1 ;;
		--launch-agent) LAUNCH_AGENT=1 ;;
		-h|--help)
			cat <<'EOF'
Quantum monorepo setup

Options:
--skip-ide       Skip IDE setup (ide/scripts/setup.sh)
--skip-agent     Skip Agent Manager setup (agent/scripts/setup.sh)
--launch-ide     Launch IDE after setup (./scripts/code.sh)
--launch-agent   Launch Agent Manager after setup (bun run dev)
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

print_setup_banner "$ROOT"
ensure_repo_layout "$ROOT"
ensure_bun
ensure_node_min "$QUANTUM_NODE_MIN_MAJOR"

if [[ "$SKIP_AGENT" -eq 0 ]]; then
	run_subsystem_setup "Quantum Agent Manager" "${ROOT}/agent" "scripts/setup.sh"
else
	log_warn "Skipping Agent Manager setup (--skip-agent)"
fi

if [[ "$SKIP_IDE" -eq 0 ]]; then
	run_subsystem_setup "Quantum IDE" "${ROOT}/ide" "scripts/setup.sh"
else
	log_warn "Skipping IDE setup (--skip-ide)"
fi

print_setup_complete "$ROOT"

if [[ "$LAUNCH_AGENT" -eq 1 ]]; then
	log_step "Launching Quantum Agent Manager"
	(cd "${ROOT}/agent" && bun run dev) &
fi

if [[ "$LAUNCH_IDE" -eq 1 ]]; then
	log_step "Launching Quantum IDE"
	(cd "${ROOT}/ide" && ./scripts/code.sh) &
fi
