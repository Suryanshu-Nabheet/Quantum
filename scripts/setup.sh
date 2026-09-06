#!/usr/bin/env bash
#
# End-to-end setup for the Quantum monorepo (IDE + Agent Manager + CLI).
#
# Installs dependencies and builds all three subsystems in a deterministic order:
#   1. CLI        (fast - Bun)
#   2. Agent      (medium - Bun + Turbo)
#   3. IDE        (slow - npm + compile; delegates to ide/scripts/setup.sh)
#
# Usage:
#   ./scripts/setup.sh                     Full ecosystem setup
#   ./scripts/setup.sh --setup-only        Same as default (no IDE launch)
#   ./scripts/setup.sh --launch-ide        Setup then launch Quantum IDE
#   ./scripts/setup.sh --verify-only       Run verification checks only
#   ./scripts/setup.sh --skip-cli          Skip CLI setup
#   ./scripts/setup.sh --skip-agent        Skip Agent Manager setup
#   ./scripts/setup.sh --skip-ide          Skip IDE setup
#   ./scripts/setup.sh --skip-install      Skip dependency installation
#   ./scripts/setup.sh --skip-build        Skip compile/build steps
#   ./scripts/setup.sh -h | --help         Show usage
#
# Windows: use scripts\setup.bat
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ROOT="$(quantum_repo_root)"
cd "$ROOT"

SETUP_CLI=true
SETUP_AGENT=true
SETUP_IDE=true
SKIP_INSTALL=false
SKIP_BUILD=false
LAUNCH_IDE=false
VERIFY_ONLY=false

usage() {
	cat <<EOF
Quantum ecosystem setup (macOS / Linux)

./scripts/setup.sh                     Install + build all subsystems
./scripts/setup.sh --launch-ide        Setup, then launch Quantum IDE
./scripts/setup.sh --verify-only       Verify setup without installing
./scripts/setup.sh --skip-cli            Skip Quantum CLI
./scripts/setup.sh --skip-agent          Skip Quantum Agent Manager
./scripts/setup.sh --skip-ide            Skip Quantum IDE
./scripts/setup.sh --skip-install        Skip dependency installation
./scripts/setup.sh --skip-build          Skip compile/build steps
./scripts/setup.sh -h | --help           Show this help

Prerequisites:
Bun >= ${QUANTUM_BUN_MIN_VERSION} (CLI + Agent Manager)
Node.js >= ${QUANTUM_CLI_NODE_MIN_MAJOR} (CLI); ${QUANTUM_IDE_NODE_VERSION} for IDE (via nvm/fnm)
npm < 11.2 (IDE only)
Python 3.10-3.13 (IDE native modules; 3.14 breaks node-gyp on macOS)

Subsystem setup scripts:
cli/scripts/setup.sh
agent/scripts/setup.sh
ide/scripts/setup.sh

After setup:
./scripts/verify.sh          Quick artifact checks
./scripts/e2e.sh             Full end-to-end smoke suite
cli:    ./cli/bin/quantum
agent:  cd agent && bun run dev
ide:    cd ide && ./scripts/code.sh
EOF
}

for arg in "$@"; do
	case "$arg" in
		-h|--help)
			usage
			exit 0
			;;
		--setup-only)
			LAUNCH_IDE=false
			;;
		--launch-ide)
			LAUNCH_IDE=true
			;;
		--verify-only)
			VERIFY_ONLY=true
			;;
		--skip-cli)
			SETUP_CLI=false
			;;
		--skip-agent)
			SETUP_AGENT=false
			;;
		--skip-ide)
			SETUP_IDE=false
			;;
		--skip-install)
			SKIP_INSTALL=true
			;;
		--skip-build)
			SKIP_BUILD=true
			;;
		*)
			die "Unknown argument: $arg (try --help)"
			;;
	esac
done

setup_cli() {
	local args=(--setup-only)
	[[ "$SKIP_INSTALL" == "true" ]] && args+=(--skip-install)
	[[ "$SKIP_BUILD" == "true" ]] && args+=(--skip-build)
	run_subsystem_setup "Quantum CLI" "${ROOT}/cli" "scripts/setup.sh" "${args[@]}"
}

setup_agent() {
	local args=(--setup-only)
	[[ "$SKIP_INSTALL" == "true" ]] && args+=(--skip-install)
	[[ "$SKIP_BUILD" == "true" ]] && args+=(--skip-build)
	run_subsystem_setup "Quantum Agent Manager" "${ROOT}/agent" "scripts/setup.sh" "${args[@]}"
}

setup_ide() {
	local args=(--setup-only)
	[[ "$SKIP_INSTALL" == "true" ]] && args+=(--skip-install)
	[[ "$SKIP_BUILD" == "true" ]] && args+=(--skip-compile)
	run_subsystem_setup "Quantum IDE" "${ROOT}/ide" "scripts/setup.sh" "${args[@]}"
}

main() {
	print_setup_banner "$ROOT"

	if [[ "$VERIFY_ONLY" == "true" ]]; then
		exec "${SCRIPT_DIR}/verify.sh"
	fi

	log_step "Checking prerequisites"
	ensure_repo_layout "$ROOT"
	ensure_bun
	ensure_node_min "$QUANTUM_CLI_NODE_MIN_MAJOR"

	if [[ "$SETUP_CLI" == "true" ]]; then
		setup_cli
	else
		log_warn "Skipping CLI (--skip-cli)"
	fi

	if [[ "$SETUP_AGENT" == "true" ]]; then
		setup_agent
	else
		log_warn "Skipping Agent Manager (--skip-agent)"
	fi

	if [[ "$SETUP_IDE" == "true" ]]; then
		setup_ide
	else
		log_warn "Skipping IDE (--skip-ide)"
	fi

	log_step "Verifying setup"
	local verify_args=()
	[[ "$SETUP_CLI" != "true" ]] && verify_args+=(--skip-cli)
	[[ "$SETUP_AGENT" != "true" ]] && verify_args+=(--skip-agent)
	[[ "$SETUP_IDE" != "true" ]] && verify_args+=(--skip-ide)
	if ! "${SCRIPT_DIR}/verify.sh" "${verify_args[@]}"; then
		die "Verification failed. Inspect output above and re-run setup."
	fi

	print_setup_complete "$ROOT"

	if [[ "$LAUNCH_IDE" == "true" ]]; then
		if [[ "$SETUP_IDE" != "true" ]]; then
			die "--launch-ide requires IDE setup (do not pass --skip-ide)."
		fi
		log_step "Launching Quantum IDE"
		exec "${ROOT}/ide/scripts/code.sh"
	fi
}

main
