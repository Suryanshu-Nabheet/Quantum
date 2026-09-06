#!/usr/bin/env bash
#
# End-to-end setup for Quantum CLI.
#
# Usage:
#   ./scripts/setup.sh                 Install dependencies and build
#   ./scripts/setup.sh --setup-only    Same as default
#   ./scripts/setup.sh --skip-install  Skip bun install
#   ./scripts/setup.sh --skip-build    Skip production build
#   ./scripts/setup.sh -h | --help     Show usage
#

set -euo pipefail

if [[ "$OSTYPE" == "darwin"* ]]; then
	ROOT="$(cd "$(dirname "$0")/.." && pwd)"
else
	ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
fi

SETUP_ONLY=true
SKIP_INSTALL=false
SKIP_BUILD=false

usage() {
	cat <<'EOF'
Quantum CLI setup

./scripts/setup.sh                  Install dependencies and build
./scripts/setup.sh --skip-install   Skip bun install
./scripts/setup.sh --skip-build     Skip production build
./scripts/setup.sh -h | --help      Show this help

Prerequisites:
  Bun >= 1.3.9
  Node.js >= 22

After setup:
  ./bin/quantum
  bun run dev
EOF
}

for arg in "$@"; do
	case "$arg" in
		-h|--help)
			usage
			exit 0
			;;
		--setup-only)
			SETUP_ONLY=true
			;;
		--skip-install)
			SKIP_INSTALL=true
			;;
		--skip-build)
			SKIP_BUILD=true
			;;
		*)
			echo "error: unknown argument: $arg" >&2
			usage >&2
			exit 1
			;;
	esac
done

cd "$ROOT"

# Colors for pretty output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}Quantum CLI Setup${NC}"
echo -e "============================\n"

# 1. Check for Prerequisites
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

# Check for Bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}[ERROR] Bun is not installed.${NC}"
    echo -e "Quantum requires Bun for the best experience."
    echo -e "Install it with: ${BOLD}curl -fsSL https://bun.sh/install | bash${NC}"
    exit 1
else
    BUN_VERSION=$(bun --version)
    echo -e "${GREEN}[OK] Bun found (v${BUN_VERSION})${NC}"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed.${NC}"
    echo -e "Quantum requires Node.js >= 22."
    exit 1
else
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d '.' -f 1)
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo -e "${YELLOW}[WARN] Node.js version is $NODE_VERSION. Recommend >= 22.${NC}"
    else
        echo -e "${GREEN}[OK] Node.js found (v${NODE_VERSION})${NC}"
    fi
fi

# 2. Install Dependencies
echo -e "\n${BLUE}[2/5] Installing dependencies...${NC}"
if [[ "$SKIP_INSTALL" != "true" ]]; then
	bun install
	echo -e "${GREEN}[OK] Dependencies installed successfully.${NC}"
else
	echo -e "${YELLOW}[SKIP] bun install (--skip-install).${NC}"
fi

# 3. Environment Setup
echo -e "\n${BLUE}[3/5] Setting up environment...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}[WARN] Created .env from .env.example.${NC}"
        echo -e "${YELLOW}Please edit .env and add your API keys.${NC}"
    else
        echo -e "${RED}[ERROR] .env.example not found. Skipping .env creation.${NC}"
    fi
else
    echo -e "${GREEN}[OK] .env file already exists.${NC}"
fi

# 4. Build the Project
echo -e "\n${BLUE}[4/5] Building Quantum CLI...${NC}"
if [[ "$SKIP_BUILD" != "true" ]]; then
	bun run build
	echo -e "${GREEN}[OK] Build completed.${NC}"
else
	echo -e "${YELLOW}[SKIP] bun run build (--skip-build).${NC}"
fi

# 5. System Health Check
echo -e "\n${BLUE}[5/5] Running system health check...${NC}"
# We use '|| true' because we don't want the script to fail if keys aren't set yet
bun run doctor:runtime || echo -e "${YELLOW}[WARN] System check reported some issues (likely missing API keys).${NC}"

echo -e "\n${GREEN}${BOLD}Quantum Setup Complete!${NC}"
echo -e "============================\n"

echo -e "${BOLD}How to use:${NC}"
echo -e "1. ${BOLD}Development Mode:${NC} Run ${BLUE}bun run dev${NC} to start directly."
echo -e "2. ${BOLD}Global Link:${NC} Run ${BLUE}npm link${NC} or ${BLUE}bun link${NC} to use 'quantum' anywhere."
echo -e "3. ${BOLD}Configuration:${NC} Check your ${BLUE}.env${NC} file for provider settings."

echo -e "\n${BLUE}Quantum initialized.${NC}"
