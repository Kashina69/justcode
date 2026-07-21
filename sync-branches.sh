#!/usr/bin/env bash
set -euo pipefail

declare -A BRANCH_FOLDERS
BRANCH_FOLDERS[archives]="archives"
BRANCH_FOLDERS[docs]="docs"
BRANCH_FOLDERS[review]="non-source-code"

ORIG_BRANCH=$(git rev-parse --abbrev-ref HEAD)

git fetch origin main 2>/dev/null

for branch in "${!BRANCH_FOLDERS[@]}"; do
  echo "=== Syncing $branch with main ==="
  folders=${BRANCH_FOLDERS[$branch]}

  # Start from main's latest, keep only the branch's unique folder
  git checkout -b "${branch}-tmp" origin/main 2>/dev/null || git checkout -b "${branch}-tmp" main

  # Restore the unique folder from the branch
  for f in $folders; do
    if git show "origin/${branch}:${f}" >/dev/null 2>&1; then
      git checkout "origin/${branch}" -- "$f"
    fi
  done

  git commit -m "Sync: rebase $branch onto main" --allow-empty

  # Replace the branch with this new state
  git checkout "$branch"
  git reset --hard "${branch}-tmp"
  git branch -D "${branch}-tmp"

  git push origin "$branch" --force
  echo "=== Done $branch ==="
done

git checkout "$ORIG_BRANCH"
echo "All branches synced to main."
