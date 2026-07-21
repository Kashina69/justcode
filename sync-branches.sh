#!/usr/bin/env bash
set -euo pipefail

# Maps branch -> folder(s) to preserve from main's deletion
declare -A BRANCH_FOLDERS
BRANCH_FOLDERS[archives]="archives"
BRANCH_FOLDERS[docs]="docs"
BRANCH_FOLDERS[review]="non-source-code"

ORIG_BRANCH=$(git rev-parse --abbrev-ref HEAD)

for branch in "${!BRANCH_FOLDERS[@]}"; do
  echo "=== Syncing $branch with main ==="
  git checkout "$branch"
  folders=${BRANCH_FOLDERS[$branch]}

  git merge main --no-commit --no-ff

  # Restore the folder(s) that main deleted — take our version
  for f in $folders; do
    git checkout HEAD -- "$f" 2>/dev/null || echo "  (no local $f, checking origin...)"
    git checkout "origin/${branch}" -- "$f" 2>/dev/null || true
  done

  git commit -m "Sync: merge main into $branch" --allow-empty
  git push origin "$branch"
  echo "=== Done $branch ==="
done

git checkout "$ORIG_BRANCH"
echo "All branches synced to main."
