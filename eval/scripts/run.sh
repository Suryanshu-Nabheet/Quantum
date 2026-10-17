#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
bash "$DIR/scripts/prereq.sh"
cd "$DIR"
exec bun run run_eval.ts "$@"
