#!/usr/bin/env bash
# Wipe GitHub Contributors (cursoragent / cursor[bot]) by recreating the repo.
# MUST be run on YOUR machine as Suryanshu-Nabheet (gh auth login), not Cursor.
set -euo pipefail

OWNER="Suryanshu-Nabheet"
REPO="quantum"
FULL="${OWNER}/${REPO}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

LOGIN="$(gh api user -q .login)"
echo "Authenticated as: ${LOGIN}"
if [[ "${LOGIN}" != "${OWNER}" ]]; then
  echo "ERROR: Run: gh auth login   (choose ${OWNER})" >&2
  exit 1
fi

# Ensure we have the clean single-commit tree
git checkout main
git fetch origin main 2>/dev/null || true

echo "== Deleting ${FULL} (this removes ALL pull refs / bot contributors) =="
gh repo delete "${FULL}" --yes

echo "== Creating fresh empty ${FULL} =="
gh repo create "${FULL}" --public \
  --description "This repository is where Suryanshu Nabheet develops the Quantum AI code editor together with the community. Not only do we work on code and issues here, but we also shape the future of AI-assisted development. This source code is available to everyone under the standard MIT license."

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${FULL}.git"

# Guarantee a single commit authored only by you
if [[ "$(git rev-list --count HEAD)" -ne 1 ]] || ! git log -1 --format='%an <%ae>' | grep -q 'Suryanshu Nabheet <suryanshunab@gmail.com>'; then
  git checkout --orphan __fresh__
  git add -A
  GIT_AUTHOR_NAME='Suryanshu Nabheet' \
  GIT_AUTHOR_EMAIL='suryanshunab@gmail.com' \
  GIT_COMMITTER_NAME='Suryanshu Nabheet' \
  GIT_COMMITTER_EMAIL='suryanshunab@gmail.com' \
  git commit -m "Initial commit: Quantum AI-native code editor"
  git branch -M main
fi

git push -u origin main

echo
echo "DONE. Open https://github.com/${FULL} — Contributors should be only you."
