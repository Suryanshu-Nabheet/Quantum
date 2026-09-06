#!/usr/bin/env bash
#
# Shared helpers for Quantum monorepo setup scripts.
#

set -euo pipefail

# Subsystem version pins (keep in sync with package.json / .nvmrc / .mise.toml)
readonly QUANTUM_IDE_NODE_VERSION="22.22.1"
readonly QUANTUM_AGENT_NODE_VERSION="24.13.1"
readonly QUANTUM_CLI_NODE_MIN_MAJOR=22
readonly QUANTUM_BUN_MIN_VERSION="1.3.9"

# Colors (disabled when NO_COLOR is set)
if [[ -z "${NO_COLOR:-}" ]]; then
	readonly C_RESET='\033[0m'
	readonly C_BOLD='\033[1m'
	readonly C_DIM='\033[2m'
	readonly C_RED='\033[31m'
	readonly C_GREEN='\033[32m'
	readonly C_YELLOW='\033[33m'
	readonly C_BLUE='\033[34m'
	readonly C_CYAN='\033[36m'
else
	readonly C_RESET='' C_BOLD='' C_DIM='' C_RED='' C_GREEN='' C_YELLOW='' C_BLUE='' C_CYAN=''
fi

quantum_repo_root() {
	local caller_dir
	# BASH_SOURCE[1] is the script that sourced this file (e.g. scripts/setup.sh).
	caller_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
	cd "${caller_dir}/.." && pwd
}

log_step() {
	echo ""
	echo -e "${C_BOLD}${C_BLUE}==>${C_RESET} ${C_BOLD}$*${C_RESET}"
	echo ""
}

log_ok() {
	echo -e "  ${C_GREEN}ok${C_RESET}  $*"
}

log_warn() {
	echo -e "  ${C_YELLOW}warn${C_RESET}  $*"
}

log_fail() {
	echo -e "  ${C_RED}fail${C_RESET}  $*" >&2
}

die() {
	log_fail "$*"
	exit 1
}

require_command() {
	local cmd="$1"
	local hint="${2:-}"
	if ! command -v "$cmd" >/dev/null 2>&1; then
		if [[ -n "$hint" ]]; then
			die "'$cmd' not found. $hint"
		fi
		die "'$cmd' not found."
	fi
}

# Compare dotted semver: returns 0 when $1 >= $2
version_gte() {
	local a="${1#v}"
	local b="${2#v}"
	if [[ "$a" == "$b" ]]; then
		return 0
	fi
	local winner
	winner="$(printf '%s\n%s\n' "$a" "$b" | sort -t. -k1,1n -k2,2n -k3,3n | tail -n1)"
	[[ "$winner" == "$a" ]]
}

ensure_bun() {
	require_command bun "Install Bun: curl -fsSL https://bun.sh/install | bash"

	local version
	version="$(bun --version 2>/dev/null || true)"
	[[ -n "$version" ]] || die "Unable to read bun version."

	if ! version_gte "$version" "$QUANTUM_BUN_MIN_VERSION"; then
		die "Bun v${version} is too old (requires >= ${QUANTUM_BUN_MIN_VERSION}). Upgrade: bun upgrade"
	fi
	log_ok "Bun v${version}"
}

ensure_node_min() {
	local min_major="$1"
	require_command node "Install Node.js >= ${min_major}."

	local version major
	version="$(node -v | sed 's/^v//')"
	major="$(echo "$version" | cut -d. -f1)"
	if (( major < min_major )); then
		die "Node.js v${version} is too old (requires >= ${min_major})."
	fi
	log_ok "Node.js v${version}"
}

ensure_repo_layout() {
	local root="$1"
	[[ -d "$root/ide" && -d "$root/agent" && -d "$root/cli" ]] || \
		die "Expected ide/, agent/, and cli/ under repository root ($root)."
	[[ -f "$root/ide/package.json" ]] || die "Missing ide/package.json."
	[[ -f "$root/agent/package.json" ]] || die "Missing agent/package.json."
	[[ -f "$root/cli/package.json" ]] || die "Missing cli/package.json."
	log_ok "Monorepo layout (ide/, agent/, cli/)"
}

run_subsystem_setup() {
	local name="$1"
	local dir="$2"
	local script_rel="$3"
	shift 3
	local extra_args=("$@")

	local script_path="${dir}/${script_rel}"
	[[ -f "$script_path" ]] || die "Missing ${name} setup script: ${script_rel}"

	log_step "Setting up ${name}"
	(
		cd "$dir"
		bash "$script_rel" "${extra_args[@]}"
	)
}

print_setup_banner() {
	local root="$1"
	echo ""
	echo -e "${C_BOLD}${C_CYAN}Quantum Ecosystem Setup${C_RESET}"
	echo -e "${C_DIM}Repository: ${root}${C_RESET}"
	echo ""
}

print_setup_complete() {
	local root="$1"
	echo ""
	echo -e "${C_GREEN}${C_BOLD}Quantum ecosystem setup complete.${C_RESET}"
	echo ""
	echo -e "${C_BOLD}Next steps${C_RESET}"
	echo "  CLI:    cd cli && ./bin/quantum"
	echo "  Agent:  cd agent && bun run dev"
	echo "  IDE:    cd ide && ./scripts/code.sh"
	echo ""
	echo "  Verify: ${root}/scripts/verify.sh"
	echo "  Docs:   ${root}/readme.md"
	echo ""
}
