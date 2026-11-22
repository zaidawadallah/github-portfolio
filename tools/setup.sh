#!/usr/bin/env bash
# Fills in your GitHub username and LinkedIn URL everywhere.
# usage: bash tools/setup.sh <github-username> <linkedin-url>
set -e
[ $# -eq 2 ] || { echo "usage: bash tools/setup.sh <github-username> <linkedin-url>"; exit 1; }
cd "$(dirname "$0")/.."
grep -rl --exclude-dir=.git --exclude=setup.sh -e GITHUB_USERNAME -e LINKEDIN_URL . | while read -r f; do
  sed -i.bak -e "s#GITHUB_USERNAME#$1#g" -e "s#LINKEDIN_URL#$2#g" "$f" && rm -f "$f.bak"
done
echo "Done. Remaining placeholders:"; grep -rn --exclude-dir=.git --exclude=setup.sh -e GITHUB_USERNAME -e LINKEDIN_URL . || echo "none"
