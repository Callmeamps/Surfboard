#!/usr/bin/env bash
set -euo pipefail

# Create release version tags
# Usage: ./scripts/release.sh [patch|minor|major]

BUMP="${1:-patch}"
VERSION=$(node -p "require('./package.json').version")
GIT_SHA=$(git rev-parse --short HEAD)

echo "══════════════════════════════════════════════════"
echo "  Surfboard Release"
echo "  Current: ${VERSION}"
echo "  Bump: ${BUMP}"
echo "══════════════════════════════════════════════════"

# Bump version using npm version
NEW_VERSION=$(npx semver "$VERSION" -i "$BUMP")

# Update package.json version manually (npm version creates a commit, we want control)
npx json -I -f package.json -e "this.version='${NEW_VERSION}'"

git add package.json
git commit -m "release: v${NEW_VERSION} (${GIT_SHA})"

# Create annotated tag
git tag -a "v${NEW_VERSION}" -m "Surfboard v${NEW_VERSION}"

echo ""
echo "✅ Release v${NEW_VERSION} tagged."
echo "   Push with: git push origin main --tags"
