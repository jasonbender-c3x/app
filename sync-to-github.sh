#!/bin/bash

set -e

REPO_URL="https://github.com/jasonbender-c3x/app.git"
BRANCH="main"

echo "=== Syncing to GitHub: $REPO_URL ==="

# Remove existing git history
rm -rf .git

# Initialize fresh git repo
git init

# Add all files
git add -A

# Commit
git commit -m "Sync from Replit - $(date '+%Y-%m-%d %H:%M:%S')"

# Rename branch to main
git branch -M $BRANCH

# Add remote
git remote add origin $REPO_URL

# Force push (overwrites everything on GitHub)
git push -f origin $BRANCH

echo "=== Done! GitHub repo has been overwritten ==="
