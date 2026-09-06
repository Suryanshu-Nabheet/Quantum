#!/usr/bin/env bash
#
# End-to-end verification for the Quantum monorepo (CLI + Agent Manager + IDE).
#
# Usage:
#   ./scripts/e2e.sh              Run the default E2E suite (recommended)
#   ./scripts/e2e.sh --full       Include long-running agent server unit tests
#   ./scripts/e2e.sh --quick      Artifacts + smoke only (skip typecheck)
#   ./scripts/e2e.sh --only cli   Test one subsystem
#   ./scripts/e2e.sh -h | --help  Show usage
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ROOT="$(quantum_repo_root)"
cd "$ROOT"

RUN_CLI=true
RUN_AGENT=true
RUN_IDE=true
MODE="default" # default | quick | full

usage() {
	cat <<'EOF'
Quantum ecosystem end-to-end tests

./scripts/e2e.sh                 Default suite (verify + smoke + typecheck)
./scripts/e2e.sh --quick         Fast smoke checks only
./scripts/e2e.sh --full          Default + full agent server test suite (~7 min)
./scripts/e2e.sh --only cli|agent|ide
./scripts/e2e.sh --skip-cli|--skip-agent|--skip-ide
./scripts/e2e.sh -h | --help

Default suite:
  1. ./scripts/verify.sh         Build artifacts for all subsystems
  2. CLI smoke + doctor
  3. Agent typecheck + brand guard + desktop smoke + dev dry-run
  4. IDE verify-dev + node-ts + electron binary + agent compile
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		-h|--help)
			usage
			exit 0
			;;
		--quick)
			MODE="quick"
			;;
		--full)
			MODE="full"
			;;
		--only)
			shift
			case "${1:-}" in
				cli) RUN_CLI=true; RUN_AGENT=false; RUN_IDE=false ;;
				agent) RUN_CLI=false; RUN_AGENT=true; RUN_IDE=false ;;
				ide) RUN_CLI=false; RUN_AGENT=false; RUN_IDE=true ;;
				*) die "Unknown --only target: ${1:-}" ;;
			esac
			;;
		--skip-cli) RUN_CLI=false ;;
		--skip-agent) RUN_AGENT=false ;;
		--skip-ide) RUN_IDE=false ;;
		*)
			die "Unknown argument: $1"
			;;
	esac
	shift
done

FAIL=0
STEP=0

run_step() {
	local label="$1"
	shift
	STEP=$((STEP + 1))
	log_step "[${STEP}] ${label}"
	if "$@"; then
		log_ok "${label}"
	else
		log_fail "${label}"
		FAIL=1
	fi
}

echo ""
echo -e "${C_BOLD}${C_CYAN}Quantum Ecosystem E2E${C_RESET}"
echo -e "${C_DIM}Root: ${ROOT} | Mode: ${MODE}${C_RESET}"
echo ""

ensure_repo_layout "$ROOT" || FAIL=1
ensure_bun
ensure_node_min "$QUANTUM_CLI_NODE_MIN_MAJOR"

verify_args=()
[[ "$RUN_CLI" != "true" ]] && verify_args+=(--skip-cli)
[[ "$RUN_AGENT" != "true" ]] && verify_args+=(--skip-agent)
[[ "$RUN_IDE" != "true" ]] && verify_args+=(--skip-ide)
if ((${#verify_args[@]} > 0)); then
	run_step "Artifact verification" "${SCRIPT_DIR}/verify.sh" "${verify_args[@]}"
else
	run_step "Artifact verification" "${SCRIPT_DIR}/verify.sh"
fi

if [[ "$RUN_CLI" == "true" ]]; then
	run_step "CLI smoke build" bash -c 'cd cli && bun run smoke'
	if [[ "$MODE" != "quick" ]]; then
		run_step "CLI doctor runtime" bash -c 'cd cli && bun run doctor:runtime'
		run_step "CLI unit sample" bash -c 'cd cli && bun test src/entrypoints/mcp.test.ts src/utils/env.test.ts'
	fi
fi

if [[ "$RUN_AGENT" == "true" ]]; then
	if [[ "$MODE" != "quick" ]]; then
		run_step "Agent typecheck" bash -c 'cd agent && bun run typecheck'
	fi
	run_step "Agent brand identity guard" bash -c 'cd agent/scripts && bun run test'
	run_step "Agent desktop smoke" bash -c 'cd agent && bun run test:desktop-smoke'
	run_step "Agent dev dry-run" bash -c \
		'cd agent && env -u QUANTUM_AUTH_TOKEN QUANTUM_NO_BROWSER=1 bun run dev -- --dry-run --home-dir ./.quantum-e2e-test'
	run_step "Agent desktop dev dry-run" bash -c \
		'cd agent && env -u QUANTUM_AUTH_TOKEN QUANTUM_NO_BROWSER=1 bun run dev:desktop -- --dry-run --home-dir ./.quantum-e2e-desktop-test'
	if [[ "$MODE" == "full" ]]; then
		run_step "Agent server unit tests (full)" bash -c 'cd agent/apps/server && bun run test'
	fi
fi

if [[ "$RUN_IDE" == "true" ]]; then
	run_step "IDE verify-dev" bash -c 'cd ide && ./scripts/verify-dev.sh'
	run_step "IDE node-ts launcher" bash -c 'cd ide && ./scripts/node-ts.sh build/lib/node.ts >/dev/null'
	run_step "IDE electron binary" test -x ide/.build/electron/Quantum.app/Contents/MacOS/Quantum
	run_step "IDE agent extension bundle" test -f ide/out/agent/out/extension.js
	run_step "IDE agent webview bundle" test -f ide/out/agent/webview/assets/index.js
	if [[ "$MODE" != "quick" ]]; then
		run_step "IDE preLaunch pipeline" bash -c 'cd ide && VSCODE_SKIP_PRELAUNCH=1 ./scripts/node-ts.sh build/lib/preLaunch.ts >/dev/null'
	fi
fi

echo ""
if (( FAIL == 0 )); then
	echo -e "${C_GREEN}${C_BOLD}All E2E checks passed.${C_RESET}"
	echo ""
	echo "Launch:"
	echo "  CLI:    ./cli/bin/quantum"
	echo "  Agent:  cd agent && bun run dev"
	echo "  IDE:    cd ide && ./scripts/code.sh"
	exit 0
fi

echo -e "${C_RED}${C_BOLD}E2E checks failed.${C_RESET} Fix the steps above, then re-run: ${ROOT}/scripts/e2e.sh"
exit 1
