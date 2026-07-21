#!/usr/bin/env bash
set -euo pipefail

declare -A BRANCH_FOLDERS
BRANCH_FOLDERS[archives]="archives"
BRANCH_FOLDERS[docs]="docs"
BRANCH_FOLDERS[review]="non-source-code"

ORIG_BRANCH=$(git rev-parse --abbrev-ref HEAD)

for branch in "${!BRANCH_FOLDERS[@]}"; do
  echo "=== Syncing $branch with main ==="
  git checkout "$branch"
  folders=${BRANCH_FOLDERS[$branch]}

  # Merge main: auto-resolve all conflicts in main's favor, don't commit yet
  git merge main --strategy-option theirs --no-commit --no-ff 2>/dev/null || true

  # Restore the folder(s) that main deleted — take our branch's version
  for f in $folders; do
    if git show HEAD:"$f" >/dev/null 2>&1; then
      git checkout HEAD -- "$f"
    else
      git checkout "origin/${branch}" -- "$f"
    fi
  done

  git commit -m "Sync: merge main into $branch" --allow-empty
  git push origin "$branch"
  echo "=== Done $branch ==="
done

git checkout "$ORIG_BRANCH"
echo "All branches synced to main."
