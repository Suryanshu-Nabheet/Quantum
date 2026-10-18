#!/usr/bin/env bash
#
# Monorepo health: layout pins, root turbo, product lockfiles, optional install state.
#
# Usage:
#   ./scripts/monorepo-doctor.sh
#   ./scripts/monorepo-doctor.sh --strict   # exit 1 if agent/ide node_modules missing
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ROOT="$(quantum_repo_root)"
STRICT=0
[[ "${1:-}" == "--strict" ]] && STRICT=1

cd "$ROOT"

layout_ok=1
agent_deps=0
ide_deps=0
turbo_ok=0

[[ -f package.json && -f package-lock.json && -f turbo.json && -f mise.toml ]] || layout_ok=0
[[ -f agent/bun.lock && -f ide/package-lock.json ]] || layout_ok=0
[[ -x node_modules/.bin/turbo ]] && turbo_ok=1
[[ -d agent/node_modules ]] && agent_deps=1
[[ -d ide/node_modules ]] && ide_deps=1

git_total=""
git_agent=""
git_ide=""
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	git_total="$(git -C "$ROOT" ls-files | wc -l | tr -d ' ')"
	git_agent="$(git -C "$ROOT" ls-files agent | wc -l | tr -d ' ')"
	git_ide="$(git -C "$ROOT" ls-files ide | wc -l | tr -d ' ')"
fi

log_step "Monorepo doctor"

echo "  Layout (root + lockfiles):  $([[ $layout_ok -eq 1 ]] && echo OK || echo FAIL)"
echo "  Root Turbo (npm ci):        $([[ $turbo_ok -eq 1 ]] && echo yes || echo 'no (run npm ci)')"
echo "  agent/node_modules:         $([[ $agent_deps -eq 1 ]] && echo yes || echo 'no (run ./scripts/setup.sh)')"
echo "  ide/node_modules:           $([[ $ide_deps -eq 1 ]] && echo yes || echo 'no (run ./scripts/setup.sh)')"
if [[ -n "$git_total" ]]; then
	echo ""
	echo "  Git tracked files: total=${git_total} agent=${git_agent} ide=${git_ide}"
fi
echo ""

if [[ $layout_ok -eq 0 ]]; then
	die "Monorepo layout check failed"
fi

if [[ $STRICT -eq 1 ]]; then
	[[ $turbo_ok -eq 1 ]] || die "Strict: run npm ci at repo root"
	[[ $agent_deps -eq 1 && $ide_deps -eq 1 ]] || die "Strict: run ./scripts/setup.sh for product dependencies"
fi

log_ok "Monorepo doctor finished"
exit 0
