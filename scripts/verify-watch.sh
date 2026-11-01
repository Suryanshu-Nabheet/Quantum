#!/usr/bin/env bash
#
# Verify that transpile --watch updates out/ when src/ changes.
# Usage: ./scripts/verify-watch.sh
#

set -euo pipefail

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname "$(dirname "$(realpath "$0")")")
else
	ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
fi

cd "$ROOT"

SRC="src/vs/workbench/browser/parts/titlebar/layoutQuickMenu.ts"
OUT="out/vs/workbench/browser/parts/titlebar/layoutQuickMenu.js"
# esbuild drops dead code (e.g. `void "…"`), so mutate a real string literal.
LOG="$(mktemp -t quantum-verify-watch.XXXXXX.log)"
PID=""
MUTATED_SRC=0

cleanup() {
	if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
		kill "$PID" 2>/dev/null || true
		wait "$PID" 2>/dev/null || true
	fi
	if [[ "$MUTATED_SRC" -eq 1 && -f "$SRC" ]]; then
		python3 - "$SRC" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text()
path.write_text(text.replace('"SettingsWatchVerify"', '"Settings"', 1))
PY
	fi
	rm -f "$LOG"
}
trap cleanup EXIT

pass() { echo "  ok  $1"; }
fail() { echo "  FAIL  $1"; exit 1; }

echo "Quantum watch verification (root: $ROOT)"
echo ""

[[ -f "$SRC" ]] || fail "missing $SRC"
[[ -f out/main.js ]] || fail "out/main.js missing — run npm run compile / setup first"

node build/next/index.ts transpile --watch >"$LOG" 2>&1 &
PID=$!

ready=0
for _ in $(seq 1 90); do
	if grep -q "Watching src" "$LOG" 2>/dev/null; then
		ready=1
		break
	fi
	if ! kill -0 "$PID" 2>/dev/null; then
		tail -40 "$LOG" || true
		fail "transpile --watch exited before becoming ready"
	fi
	sleep 1
done
[[ "$ready" -eq 1 ]] || fail "transpile --watch did not become ready in time"
pass "transpile --watch ready"

python3 - "$SRC" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text()
needle = "localize('layoutQuickMenu.quantumSettings', \"Settings\")"
replacement = "localize('layoutQuickMenu.quantumSettings', \"SettingsWatchVerify\")"
if needle not in text:
    # already double-quoted after prior formatting
    needle = 'localize("layoutQuickMenu.quantumSettings", "Settings")'
    replacement = 'localize("layoutQuickMenu.quantumSettings", "SettingsWatchVerify")'
if needle not in text:
    raise SystemExit(f"could not find settings localize string in {path}")
path.write_text(text.replace(needle, replacement, 1))
PY
MUTATED_SRC=1

updated=0
for _ in $(seq 1 40); do
	if grep -q "SettingsWatchVerify" "$OUT" 2>/dev/null; then
		updated=1
		break
	fi
	sleep 0.5
done

[[ "$updated" -eq 1 ]] || {
	echo "---- watch log ----"
	tail -60 "$LOG" || true
	fail "out/ did not receive SettingsWatchVerify after editing $SRC"
}

pass "incremental transpile updated $OUT"
echo ""
echo "Watch verification passed."
