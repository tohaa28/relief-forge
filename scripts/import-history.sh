#!/usr/bin/env bash
# One-time, fast-forward-only preservation of the exact pre-GitHub commit graph.
set -euo pipefail
sha256sum -c history/pre-github.bundle.sha256
git bundle verify history/pre-github.bundle
git fetch --no-tags history/pre-github.bundle refs/heads/main
original_head=$(git rev-parse FETCH_HEAD)
if git merge-base --is-ancestor "$original_head" HEAD; then
  printf 'Original development history is already preserved.\n'
  exit 0
fi
git config user.name 'Relief Forge history migration'
git config user.email 'relief-forge@users.noreply.github.com'
tree=$(git rev-parse 'HEAD^{tree}')
current_head=$(git rev-parse HEAD)
merge_head=$(git commit-tree "$tree" -p "$current_head" -p "$original_head" -m 'Preserve complete pre-GitHub development history')
# This is a normal fast-forward push, never a forced rewrite.
git push origin "$merge_head:refs/heads/main"
git reset --soft "$merge_head"
git merge-base --is-ancestor "$original_head" HEAD
printf 'Preserved original commit %s and all its ancestors.\n' "$original_head"
