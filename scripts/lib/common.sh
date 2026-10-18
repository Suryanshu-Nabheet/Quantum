#!/usr/bin/env bash
#
# Shared helpers for Quantum monorepo setup scripts.
#

set -euo pipefail

# Subsystem version pins (keep in sync with mise.toml, ide/.nvmrc, agent/package.json)
readonly QUANTUM_IDE_NODE_VERSION="22.22.1"
readonly QUANTUM_AGENT_NODE_VERSION="24.13.1"
readonly QUANTUM_NODE_MIN_MAJOR=24
readonly QUANTUM_BUN_MIN_VERSION="1.3.9"
readonly QUANTUM_ROOT_NPM_MAX_MAJOR=11
readonly QUANTUM_ROOT_NPM_MAX_MINOR=2

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
	local nvm_script="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
	local brew_node=""

	local version=""
	if command -v node >/dev/null 2>&1; then
		version="$(node -v | sed 's/^v//')"
	fi

	local major="0"
	if [[ -n "$version" ]]; then
		major="${version%%.*}"
	fi

	# Homebrew versioned Node formulas are intentionally unlinked, so their
	# binaries may be installed without appearing on PATH. Prefer one if the
	# current node is absent or too old.
	if (( major < min_major )) && command -v brew >/dev/null 2>&1; then
		brew_node="$(brew --prefix node@${min_major} 2>/dev/null || true)"
		if [[ -x "${brew_node}/bin/node" ]]; then
			export PATH="${brew_node}/bin:${PATH}"
			version="$(node -v | sed 's/^v//')"
			major="${version%%.*}"
		fi
	fi

	# Setup is commonly launched from a non-interactive shell where nvm's
	# shell initialization has not run. Load it here and select the Agent
	# Manager's pinned runtime before starting either subsystem.
	if (( major < min_major )) && [[ -s "$nvm_script" ]]; then
		# shellcheck source=/dev/null
		source "$nvm_script"
		nvm install "$QUANTUM_AGENT_NODE_VERSION"
		nvm use "$QUANTUM_AGENT_NODE_VERSION" >/dev/null
		version="$(node -v | sed 's/^v//')"
		major="${version%%.*}"
	fi

	if (( major < min_major )) && command -v fnm >/dev/null 2>&1; then
		eval "$(fnm env --shell bash 2>/dev/null || fnm env)"
		fnm install "$QUANTUM_AGENT_NODE_VERSION" --if-not-present
		fnm use "$QUANTUM_AGENT_NODE_VERSION" >/dev/null
		version="$(node -v | sed 's/^v//')"
		major="${version%%.*}"
	fi

	if (( major < min_major )); then
		die "Node.js >= ${min_major} is required. Install Node.js or use nvm/fnm; if using nvm, run: nvm install ${QUANTUM_AGENT_NODE_VERSION}"
	fi
	log_ok "Node.js v${version}"
}

ensure_repo_layout() {
	local root="$1"
	[[ -d "$root/ide" && -d "$root/agent" ]] || \
		die "Expected ide/ and agent/ under repository root ($root)."
	[[ -f "$root/ide/package.json" ]] || die "Missing ide/package.json."
	[[ -f "$root/agent/package.json" ]] || die "Missing agent/package.json."
	[[ -f "$root/package.json" ]] || die "Missing package.json (monorepo orchestration)."
	[[ -f "$root/turbo.json" ]] || die "Missing turbo.json."
	[[ -f "$root/mise.toml" ]] || die "Missing mise.toml (toolchain pins)."
	log_ok "Monorepo layout (root orchestration, ide/, agent/)"
}

ensure_mise_toolchain() {
	local root="$1"
	if ! command -v mise >/dev/null 2>&1; then
		log_warn "mise not installed — using system Bun/Node (see docs/architecture/monorepo-orchestration.md)"
		return 0
	fi

	log_step "Toolchain (mise)"
	(
		cd "$root"
		mise install -y 2>/dev/null || mise install 2>/dev/null || true
	)
	log_ok "mise toolchain (mise.toml)"
}

ensure_root_npm_version() {
	if ! command -v npm >/dev/null 2>&1; then
		die "npm is required for root orchestration (install Node.js or run mise install)."
	fi

	local npm_user_agent
	npm_user_agent="$(npm --version 2>/dev/null || true)"
	[[ -n "$npm_user_agent" ]] || die "Unable to read npm version."

	local major="${npm_user_agent%%.*}"
	local rest="${npm_user_agent#*.}"
	local minor="${rest%%.*}"

	if (( major > QUANTUM_ROOT_NPM_MAX_MAJOR )) || \
		(( major == QUANTUM_ROOT_NPM_MAX_MAJOR && minor >= QUANTUM_ROOT_NPM_MAX_MINOR )); then
		die "Root orchestration requires npm < ${QUANTUM_ROOT_NPM_MAX_MAJOR}.${QUANTUM_ROOT_NPM_MAX_MINOR}.0 (IDE upstream constraint). Current: v${npm_user_agent}"
	fi
}

ensure_root_orchestration() {
	local root="$1"
	local lock="${root}/package-lock.json"
	local turbo_bin="${root}/node_modules/.bin/turbo"

	if [[ ! -f "$lock" ]]; then
		log_warn "Missing package-lock.json — run: (cd \"${root}\" && npm install)"
		return 0
	fi

	ensure_root_npm_version

	if [[ -x "$turbo_bin" ]]; then
		log_ok "Root orchestration (turbo)"
		return 0
	fi

	log_step "Installing root orchestration dependencies (npm ci)"
	(
		cd "$root"
		npm ci --no-audit --no-fund
	)
	log_ok "Root orchestration (turbo)"
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
		# With `set -u`, an empty array expansion is an unbound variable on Bash 3.2+/macOS.
		if ((${#extra_args[@]} > 0)); then
			bash "$script_rel" "${extra_args[@]}"
		else
			bash "$script_rel"
		fi
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
	echo "  Agent:  cd agent && bun run dev"
	echo "  IDE:    cd ide && ./scripts/code.sh"
	echo ""
	echo "  Verify: ${root}/scripts/verify.sh  (or: npm run verify)"
	echo "  Eval:   npm run eval"
	echo "  Docs:   ${root}/docs/architecture/monorepo-orchestration.md"
	echo ""
}
