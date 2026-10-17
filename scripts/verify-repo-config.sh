#!/usr/bin/env bash
#
# Ensures shared repo / editor config exists and is committable (not gitignored).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ROOT="$(quantum_repo_root)"
cd "$ROOT"

REQUIRED_PATHS=(
	AGENTS.md
	Quantum.code-workspace
	.editorconfig
	.gitattributes
	.cursorignore
	.cursor/mcp.json
	.cursor/rules/quantum-monorepo.mdc
	.vscode/settings.json
	.vscode/tasks.json
	.vscode/launch.json
	.vscode/extensions.json
	.vscode/README.md
	docs/readme.md
	docs/getting-started.md
	docs/for-agents.md
	docs/products/workbench-agent.md
	docs/version-control.md
	.idea/modules.xml
	.idea/misc.xml
	.idea/vcs.xml
	.idea/Quantum.iml
)

log_step "Verifying repository config (commit policy)"

MISSING=0
IGNORED=0

for rel in "${REQUIRED_PATHS[@]}"; do
	if [[ ! -e "$rel" ]]; then
		log_fail "Missing required path: $rel"
		MISSING=1
		continue
	fi
	if git check-ignore -q "$rel"; then
		log_fail "Path is gitignored but must be committable: $rel"
		git check-ignore -v "$rel" >&2 || true
		IGNORED=1
	fi
done

if [[ "$MISSING" -eq 0 && "$IGNORED" -eq 0 ]]; then
	log_ok "All ${#REQUIRED_PATHS[@]} required config paths present and committable"
	exit 0
fi

die "Repository config verification failed (see docs/version-control.md)"
exit 1
